import crypto from "crypto";
import prisma from "../../config/prismaClient";
import redisService from "../../utils/redisService";
import { calculateRuleBasedMatch } from "../ai-match/ruleBasedMatch.service";
import { includeJobDetails, toJobResponse } from "../job/job.service";
import { IRecommendationCandidate, IRecommendedJobsQuery, RecommendationEmptyReason } from "./recommendation.interface";

const CANDIDATE_POOL_SIZE = 200; // the latest OPEN jobs that get scored
const MAX_FEED_SIZE = 30; // how many ranked jobs are kept (and the max `limit`)
const FEED_CACHE_TTL_SECONDS = 10 * 60;
const FEED_CACHE_VERSION = "v1";

type RecommendedItem = {
  job: ReturnType<typeof toJobResponse>;
  matchScore: number;
  matchedSkills: string[];
};

const loadMatchingProfile = (userId: string) =>
  prisma.freelancerProfile.findUnique({
    where: { userId },
    select: {
      experienceLevel: true,
      skills: { select: { skill: { select: { name: true } } } },
      // The matcher only checks whether a portfolio exists, so one row is enough.
      portfolios: { select: { id: true }, take: 1 },
    },
  });

type MatchingProfile = NonNullable<Awaited<ReturnType<typeof loadMatchingProfile>>>;

// Everything the score depends on. If the freelancer edits their profile in a way
// that matters, this changes, the cache key changes, and the feed refreshes at once.
const buildProfileFingerprint = (profile: MatchingProfile): string => {
  const payload = JSON.stringify({
    level: profile.experienceLevel,
    skills: profile.skills.map(({ skill }) => skill.name.toLowerCase()).sort(),
    hasPortfolio: profile.portfolios.length > 0,
  });
  return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 12);
};

const readCache = async (key: string): Promise<IRecommendationCandidate[] | null> => {
  const raw = await redisService.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as IRecommendationCandidate[];
  } catch {
    return null;
  }
};

const writeCache = async (key: string, candidates: IRecommendationCandidate[]): Promise<void> => {
  try {
    await redisService.set(key, JSON.stringify(candidates), FEED_CACHE_TTL_SECONDS);
  } catch (error) {
    // A failed cache write must never break the feed; it just gets recomputed next time.
    console.warn("[Recommendations] Could not cache the feed:", error);
  }
};

// Scores the latest OPEN jobs with the existing rule-based matcher and keeps the best ones.
const rankCandidates = async (userId: string, profile: MatchingProfile): Promise<IRecommendationCandidate[]> => {
  const jobs = await prisma.job.findMany({
    where: {
      status: "OPEN",
      applications: { none: { freelancerId: userId } },
      client: { deletedAt: null, isSuspended: false },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: CANDIDATE_POOL_SIZE,
    select: {
      id: true,
      createdAt: true,
      experienceLevel: true,
      skills: { select: { skill: { select: { name: true } } } },
    },
  });

  return jobs
    .map((job) => {
      const { matchScore, breakdown } = calculateRuleBasedMatch(job, profile);

      // The matcher lowercases skill names; show them the way the job spells them.
      const originalNames = new Map(job.skills.map(({ skill }) => [skill.name.toLowerCase(), skill.name]));

      return {
        jobId: job.id,
        createdAt: job.createdAt,
        matchScore,
        matchedSkills: breakdown.matchedSkills.map((name) => originalNames.get(name) ?? name),
      };
    })
    // A job that shares no skill with the freelancer is not a recommendation, even
    // if the experience level and portfolio points give it a non-zero score.
    .filter((candidate) => candidate.matchedSkills.length > 0)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.matchedSkills.length - a.matchedSkills.length ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.jobId.localeCompare(b.jobId)
    )
    .slice(0, MAX_FEED_SIZE)
    .map(({ jobId, matchScore, matchedSkills }) => ({ jobId, matchScore, matchedSkills }));
};

const emptyResult = (reason: RecommendationEmptyReason, message: string) => ({
  items: [] as RecommendedItem[],
  reason,
  message,
});

const NO_MATCHES_MESSAGE = "No open jobs match your skills right now. Check back soon.";

export const getRecommendedJobs = async (userId: string, query: IRecommendedJobsQuery) => {
  const profile = await loadMatchingProfile(userId);

  // These two are cheap to detect, so they are never cached.
  if (!profile) {
    return emptyResult("NO_PROFILE", "Create your freelancer profile to get job recommendations");
  }
  if (profile.skills.length === 0) {
    return emptyResult("NO_SKILLS", "Add skills to your profile to get job recommendations");
  }

  const cacheKey = `jobs:recommended:${FEED_CACHE_VERSION}:${userId}:${buildProfileFingerprint(profile)}`;

  let candidates = await readCache(cacheKey);
  if (!candidates) {
    candidates = await rankCandidates(userId, profile);
    if (candidates.length > 0) await writeCache(cacheKey, candidates);
  }

  if (candidates.length === 0) {
    return emptyResult("NO_MATCHES", NO_MATCHES_MESSAGE);
  }

  // The cache only holds the ranking. The jobs themselves are read fresh every time,
  // so a job that closed, or that the freelancer just applied to, drops out immediately.
  const candidateIds = candidates.map((candidate) => candidate.jobId);
  const [jobs, savedRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        id: { in: candidateIds },
        status: "OPEN",
        applications: { none: { freelancerId: userId } },
        client: { deletedAt: null, isSuspended: false },
      },
      include: includeJobDetails,
    }),
    prisma.savedJob.findMany({ where: { userId, jobId: { in: candidateIds } }, select: { jobId: true } }),
  ]);

  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const savedIds = new Set(savedRows.map((row) => row.jobId));

  const items: RecommendedItem[] = [];
  for (const candidate of candidates) {
    const job = jobsById.get(candidate.jobId);
    if (!job) continue;

    items.push({
      // hasApplied is always false: applied jobs are excluded above.
      job: toJobResponse(job, { isSaved: savedIds.has(job.id), hasApplied: false }),
      matchScore: candidate.matchScore,
      matchedSkills: candidate.matchedSkills,
    });
    if (items.length === query.limit) break;
  }

  if (items.length === 0) {
    return emptyResult("NO_MATCHES", NO_MATCHES_MESSAGE);
  }

  return { items, reason: null, message: "Recommended jobs fetched" };
};