import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { Prisma } from "../../../generated/prisma";
import { findOrCreateSkill } from "../skill/skill.service";
import {
  ICreateFreelancerProfile,
  IUpdateFreelancerProfile,
  IAddExperience,
  IAddPortfolio,
  IFreelancerListQuery,
  IFreelancerListItem,
} from "./freelancer-profile.interface";
import { calculateProfileCompletion } from "./freelancer-profile.utils";

const includeFullProfile = {
  skills: { include: { skill: true } },
  experiences: true,
  portfolios: true,
};

export const createFreelancerProfile = async (
  userId: string,
  data: ICreateFreelancerProfile,
) => {
  const existing = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (existing) throw new ApiError(409, "Freelancer profile already exists");
  return prisma.freelancerProfile.create({ data: { userId, ...data } });
};

export const getMyFreelancerProfile = async (userId: string) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
    include: includeFullProfile,
  });
  if (!profile)
    throw new ApiError(404, "Freelancer profile not found. Create one first.");

  const completionPercentage = calculateProfileCompletion({
    title: profile.title,
    bio: profile.bio,
    hourlyRate: profile.hourlyRate,
    experienceLevel: profile.experienceLevel,
    skillCount: profile.skills.length,
    experienceCount: profile.experiences.length,
    portfolioCount: profile.portfolios.length,
  });

  return { ...profile, completionPercentage };
};

export const updateFreelancerProfile = async (
  userId: string,
  currentUser: JwtPayload,
  data: IUpdateFreelancerProfile,
) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  checkOwnership(profile.userId, currentUser);
  return prisma.freelancerProfile.update({ where: { userId }, data });
};

export const addSkill = async (userId: string, skillName: string) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");

  const skill = await findOrCreateSkill(skillName);
  const existingLink = await prisma.freelancerSkill.findUnique({
    where: {
      freelancerProfileId_skillId: {
        freelancerProfileId: profile.id,
        skillId: skill.id,
      },
    },
  });
  if (existingLink) throw new ApiError(409, "Skill already added");

  return prisma.freelancerSkill.create({
    data: { freelancerProfileId: profile.id, skillId: skill.id },
    include: { skill: true },
  });
};

export const removeSkill = async (
  userId: string,
  skillId: string,
  currentUser: JwtPayload,
) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  checkOwnership(profile.userId, currentUser);
  await prisma.freelancerSkill.delete({
    where: {
      freelancerProfileId_skillId: { freelancerProfileId: profile.id, skillId },
    },
  });
};

export const addExperience = async (userId: string, data: IAddExperience) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  return prisma.experience.create({
    data: { freelancerProfileId: profile.id, ...data },
  });
};

export const deleteExperience = async (
  experienceId: string,
  currentUser: JwtPayload,
) => {
  const experience = await prisma.experience.findUnique({
    where: { id: experienceId },
    include: { freelancerProfile: true },
  });
  if (!experience) throw new ApiError(404, "Experience not found");
  checkOwnership(experience.freelancerProfile.userId, currentUser);
  await prisma.experience.delete({ where: { id: experienceId } });
};

export const addPortfolio = async (userId: string, data: IAddPortfolio) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  return prisma.portfolio.create({
    data: { freelancerProfileId: profile.id, ...data },
  });
};

export const deletePortfolio = async (
  portfolioId: string,
  currentUser: JwtPayload,
) => {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { freelancerProfile: true },
  });
  if (!portfolio) throw new ApiError(404, "Portfolio item not found");
  checkOwnership(portfolio.freelancerProfile.userId, currentUser);
  await prisma.portfolio.delete({ where: { id: portfolioId } });
};

export const getPublicFreelancerProfile = async (userId: string) => {
  const profile = await prisma.freelancerProfile.findFirst({
    where: { userId, user: { deletedAt: null } },
    include: {
      ...includeFullProfile,
      user: { select: { name: true, createdAt: true, imageUrl: true } },
    },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");

  return {
    ...profile,
    name: profile.user.name,
    imageUrl: profile.user.imageUrl,
  };
};

const directoryInclude = {
  user: { select: { name: true, imageUrl: true } },
  skills: {
    select: { skill: { select: { id: true, name: true } } },
    orderBy: { skill: { name: "asc" } },
  },
  _count: { select: { skills: true, experiences: true, portfolios: true } },
} satisfies Prisma.FreelancerProfileInclude;

type DirectoryProfile = Prisma.FreelancerProfileGetPayload<{
  include: typeof directoryInclude;
}>;

interface RatingStat {
  averageRating: number;
  totalReviews: number;
}

const NO_RATING: RatingStat = { averageRating: 0, totalReviews: 0 };
const MAX_SKILL_FILTERS = 10;

const parseSkillNames = (raw?: string): string[] => {
  if (!raw) return [];
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names.map((name) => name.toLowerCase()))].slice(
    0,
    MAX_SKILL_FILTERS,
  );
};

const fetchRatingStats = async (options: {
  userIds?: string[];
  minRating?: number;
}): Promise<Map<string, RatingStat>> => {
  const rows = await prisma.review.groupBy({
    by: ["revieweeId"],
    where: options.userIds
      ? { revieweeId: { in: options.userIds } }
      : undefined,
    _avg: { rating: true },
    _count: { rating: true },
    having: { rating: { _avg: { gte: options.minRating ?? 0 } } },
  });

  return new Map(
    rows.map((row) => [
      row.revieweeId,
      {
        averageRating:
          row._avg.rating === null ? 0 : Math.round(row._avg.rating * 10) / 10,
        totalReviews: row._count.rating,
      },
    ]),
  );
};

const buildDirectoryWhere = (
  query: IFreelancerListQuery,
  skillNames: string[],
  eligibleUserIds?: string[],
): Prisma.FreelancerProfileWhereInput => {
  // Only profiles that actually have a title and a bio are listed.
  const and: Prisma.FreelancerProfileWhereInput[] = [
    { title: { not: null } },
    { title: { not: "" } },
    { bio: { not: null } },
    { bio: { not: "" } },
  ];

  if (query.search) {
    and.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { bio: { contains: query.search, mode: "insensitive" } },
        { user: { name: { contains: query.search, mode: "insensitive" } } },
        {
          skills: {
            some: {
              skill: { name: { contains: query.search, mode: "insensitive" } },
            },
          },
        },
      ],
    });
  }

  if (skillNames.length > 0) {
    and.push({
      skills: {
        some: {
          skill: {
            OR: skillNames.map((name) => ({
              name: { equals: name, mode: "insensitive" as const },
            })),
          },
        },
      },
    });
  }

  const where: Prisma.FreelancerProfileWhereInput = {
    AND: and,
    user: { deletedAt: null },
    ...(query.experienceLevel && { experienceLevel: query.experienceLevel }),
    ...(query.availability && { availability: query.availability }),
    ...(eligibleUserIds && { userId: { in: eligibleUserIds } }),
  };

  if (query.minRate !== undefined || query.maxRate !== undefined) {
    where.hourlyRate = {
      ...(query.minRate !== undefined && { gte: query.minRate }),
      ...(query.maxRate !== undefined && { lte: query.maxRate }),
    };
  }

  return where;
};

const getDatabaseOrderBy = (
  sortBy: Exclude<IFreelancerListQuery["sortBy"], "rating">,
): Prisma.FreelancerProfileOrderByWithRelationInput[] => {
  switch (sortBy) {
    case "rate_asc":
      return [
        { hourlyRate: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "asc" },
      ];
    case "rate_desc":
      return [
        { hourlyRate: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "asc" },
      ];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
};

const toDirectoryItem = (
  profile: DirectoryProfile,
  stat: RatingStat,
): IFreelancerListItem => ({
  userId: profile.userId,
  name: profile.user.name,
  imageUrl: profile.user.imageUrl,
  title: profile.title,
  bio: profile.bio,
  hourlyRate: profile.hourlyRate === null ? null : Number(profile.hourlyRate),
  experienceLevel: profile.experienceLevel,
  availability: profile.availability,
  skills: profile.skills.map(({ skill }) => ({
    id: skill.id,
    name: skill.name,
  })),
  averageRating: stat.averageRating,
  totalReviews: stat.totalReviews,
  completionPercentage: calculateProfileCompletion({
    title: profile.title,
    bio: profile.bio,
    hourlyRate: profile.hourlyRate,
    experienceLevel: profile.experienceLevel,
    skillCount: profile._count.skills,
    experienceCount: profile._count.experiences,
    portfolioCount: profile._count.portfolios,
  }),
});

export const listFreelancers = async (query: IFreelancerListQuery) => {
  const { skip, take, page, limit } = getPagination(query);
  const skillNames = parseSkillNames(query.skills);

  const needsGlobalRatings =
    query.minRating !== undefined || query.sortBy === "rating";
  let ratingStats: Map<string, RatingStat> | null = needsGlobalRatings
    ? await fetchRatingStats({ minRating: query.minRating })
    : null;

  const eligibleUserIds =
    query.minRating !== undefined && ratingStats
      ? [...ratingStats.keys()]
      : undefined;
  const where = buildDirectoryWhere(query, skillNames, eligibleUserIds);

  let profiles: DirectoryProfile[];
  let total: number;

  if (query.sortBy === "rating") {
    const stats = ratingStats as Map<string, RatingStat>;
    const candidates = await prisma.freelancerProfile.findMany({
      where,
      select: { userId: true, createdAt: true },
    });

    candidates.sort((a, b) => {
      const ratingA = stats.get(a.userId) ?? NO_RATING;
      const ratingB = stats.get(b.userId) ?? NO_RATING;
      return (
        ratingB.averageRating - ratingA.averageRating ||
        ratingB.totalReviews - ratingA.totalReviews ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.userId.localeCompare(b.userId)
      );
    });

    total = candidates.length;
    const pageIds = candidates
      .slice(skip, skip + take)
      .map((candidate) => candidate.userId);

    const loaded = await prisma.freelancerProfile.findMany({
      where: { userId: { in: pageIds } },
      include: directoryInclude,
    });
    const byUserId = new Map(
      loaded.map((profile) => [profile.userId, profile]),
    );
    profiles = pageIds.flatMap((id) => byUserId.get(id) ?? []);
  } else {
    const [rows, count] = await Promise.all([
      prisma.freelancerProfile.findMany({
        where,
        orderBy: getDatabaseOrderBy(query.sortBy),
        skip,
        take,
        include: directoryInclude,
      }),
      prisma.freelancerProfile.count({ where }),
    ]);
    profiles = rows;
    total = count;

    if (!ratingStats) {
      ratingStats =
        profiles.length > 0
          ? await fetchRatingStats({
              userIds: profiles.map((profile) => profile.userId),
            })
          : new Map();
    }
  }

  const stats = ratingStats ?? new Map<string, RatingStat>();
  const items = profiles.map((profile) =>
    toDirectoryItem(profile, stats.get(profile.userId) ?? NO_RATING),
  );

  return { items, meta: buildMeta(total, page, limit) };
};
