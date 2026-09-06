import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import redisService from "../../utils/redisService";
import { gemini } from "../../config/geminiClient";
import { env } from "../../config/env";
import { calculateRuleBasedMatch } from "./ruleBasedMatch.service";
import { aiMatchResponseSchema } from "./ai-match.validation";
import { IAiMatchResult } from "./ai-match.interface";

const getJobAndFreelancer = async (jobId: string, freelancerId: string) => {
  const [job, freelancerProfile] = await Promise.all([
    prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: { include: { skill: true } } },
    }),
    prisma.freelancerProfile.findUnique({
      where: { userId: freelancerId },
      include: {
        skills: { include: { skill: true } },
        portfolios: true,
        experiences: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  if (!job) throw new ApiError(404, "Job not found");
  if (!freelancerProfile)
    throw new ApiError(
      404,
      "Complete your freelancer profile before requesting a match analysis",
    );

  return { job, freelancerProfile };
};

export const getRuleBasedMatch = async (
  jobId: string,
  freelancerId: string,
) => {
  const { job, freelancerProfile } = await getJobAndFreelancer(
    jobId,
    freelancerId,
  );
  return calculateRuleBasedMatch(job, freelancerProfile);
};

const GEMINI_MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
];

const callAiForAnalysis = async (
  job: any,
  freelancerProfile: any,
): Promise<IAiMatchResult> => {
  const jobSkills = job.skills.map((s: any) => s.skill.name).join(", ");
  const freelancerSkills = freelancerProfile.skills
    .map((s: any) => s.skill.name)
    .join(", ");
  const portfolioSummary =
    freelancerProfile.portfolios.map((p: any) => p.title).join("; ") ||
    "None listed";

  const prompt = `Analyze how well this freelancer matches this job. Respond with ONLY valid JSON, no markdown formatting, no preamble, no explanation outside the JSON.

JSON shape required:
{"matchScore": number (0-100), "strengths": string[] (max 5), "missingSkills": string[] (max 5), "recommendation": string (1-2 sentences)}

JOB:
Title: ${job.title}
Description: ${job.description}
Required skills: ${jobSkills}
Experience level required: ${job.experienceLevel}

FREELANCER:
Title: ${freelancerProfile.title ?? "Not set"}
Bio: ${freelancerProfile.bio ?? "Not set"}
Skills: ${freelancerSkills}
Experience level: ${freelancerProfile.experienceLevel ?? "Not set"}
Portfolio projects: ${portfolioSummary}`;

  let rawText: string | null = null;
  let lastError: unknown = null;

  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: prompt,
      });
      rawText = response.text ?? "";
      if (rawText) {
        console.log(`[AI Match] Successfully used model "${model}"`);
        break;
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`[AI Match] Model "${model}" failed:`, {
        status: error?.status,
        message: error?.message,
        details: error?.error ?? error?.response?.data ?? null,
      });
    }
  }

  if (!rawText) {
    console.error(
      "[AI Match] All Gemini model candidates failed. Last error was:",
      lastError,
    );
    throw new ApiError(
      502,
      "AI analysis service is temporarily unavailable. Please try again shortly.",
    );
  }

  let parsedJson: unknown;
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsedJson = JSON.parse(cleaned);
  } catch (error) {
    console.error("[AI Match] Failed to parse AI response as JSON:", rawText);
    throw new ApiError(
      502,
      "AI returned an unreadable response. Please try again.",
    );
  }

  const validation = aiMatchResponseSchema.safeParse(parsedJson);
  if (!validation.success) {
    console.error(
      "[AI Match] AI response failed schema validation:",
      validation.error.flatten(),
    );
    throw new ApiError(
      502,
      "AI returned an invalid response format. Please try again.",
    );
  }

  return validation.data;
};

export const requestAiAnalysis = async (
  jobId: string,
  freelancerId: string,
) => {
  const { job, freelancerProfile } = await getJobAndFreelancer(
    jobId,
    freelancerId,
  );

  // Rate limit BEFORE spending money on an API call.
  const usageKey = `ai:usage:${freelancerId}`;
  const currentUsage = await redisService.increment(usageKey, 24 * 60 * 60);
  if (currentUsage > env.AI_DAILY_REQUEST_LIMIT) {
    throw new ApiError(
      429,
      `Daily AI analysis limit reached (${env.AI_DAILY_REQUEST_LIMIT}/day). Try again tomorrow.`,
    );
  }

  const result = await callAiForAnalysis(job, freelancerProfile);

  // Save/overwrite — treated as a recommendation snapshot, not an audit log.
  return prisma.jobMatchAnalysis.upsert({
    where: { jobId_freelancerId: { jobId, freelancerId } },
    update: { ...result },
    create: { jobId, freelancerId, ...result },
  });
};

export const getSavedAnalysis = async (jobId: string, freelancerId: string) => {
  const analysis = await prisma.jobMatchAnalysis.findUnique({
    where: { jobId_freelancerId: { jobId, freelancerId } },
  });
  if (!analysis)
    throw new ApiError(404, "No analysis found. Request one first.");
  return analysis;
};
