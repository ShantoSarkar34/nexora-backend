import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { findOrCreateSkill } from "../skill/skill.service";
import { getPagination, buildMeta } from "../../utils/pagination";
import { JOB_STATUS_TRANSITIONS, EDITABLE_JOB_STATUSES } from "./job.constants";
import { ICreateJob, IUpdateJob, IJobListQuery } from "./job.interface";
import { JobStatus, Prisma } from "../../../generated/prisma";
import redisService from "../../utils/redisService";

const includeJobDetails = {
  skills: { include: { skill: true } },
  client: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      clientProfile: { select: { companyName: true } },
    },
  },
  // WITHDRAWN applications don't count as applicants.
  _count: {
    select: { applications: { where: { status: { not: "WITHDRAWN" } } } },
  },
} satisfies Prisma.JobInclude;

type JobWithDetails = Prisma.JobGetPayload<{
  include: typeof includeJobDetails;
}>;

interface JobFlags {
  isSaved: boolean;
  hasApplied: boolean;
}

const NO_FLAGS: JobFlags = { isSaved: false, hasApplied: false };

const toJobResponse = (job: JobWithDetails, flags: JobFlags = NO_FLAGS) => {
  const { _count, ...rest } = job;
  return {
    ...rest,
    budgetMin: Number(job.budgetMin),
    budgetMax: Number(job.budgetMax),
    clientName: job.client.name,
    clientImageUrl: job.client.imageUrl,
    companyName: job.client.clientProfile?.companyName ?? null,
    applicantCount: _count.applications,
    ...flags,
  };
};

type JobResponse = ReturnType<typeof toJobResponse>;


const getJobFlagSets = async (
  user: JwtPayload | undefined,
  jobIds: string[],
) => {
  if (!user || user.role !== "FREELANCER" || jobIds.length === 0) {
    return { saved: new Set<string>(), applied: new Set<string>() };
  }

  const [saved, applied] = await Promise.all([
    prisma.savedJob.findMany({
      where: { userId: user.userId, jobId: { in: jobIds } },
      select: { jobId: true },
    }),
    prisma.application.findMany({
      where: { freelancerId: user.userId, jobId: { in: jobIds } },
      select: { jobId: true },
    }),
  ]);

  return {
    saved: new Set(saved.map((row) => row.jobId)),
    applied: new Set(applied.map((row) => row.jobId)),
  };
};

const withUserFlags = async <T extends { id: string }>(
  jobs: T[],
  user?: JwtPayload,
) => {
  const { saved, applied } = await getJobFlagSets(
    user,
    jobs.map((job) => job.id),
  );
  return jobs.map((job) => ({
    ...job,
    isSaved: saved.has(job.id),
    hasApplied: applied.has(job.id),
  }));
};

const JOB_LIST_CACHE_TTL = 60;
// Bump this whenever the cached response shape changes so old entries are never served.
const JOB_LIST_SHAPE_VERSION = "s2";

const getJobListCacheKey = async (query: IJobListQuery): Promise<string> => {
  const version = (await redisService.get("jobs:list:version")) ?? "1";
  const normalized = JSON.stringify(query, Object.keys(query).sort());
  return `jobs:list:${JOB_LIST_SHAPE_VERSION}:v${version}:${normalized}`;
};

const invalidateJobListCache = async (): Promise<void> => {
  await redisService.increment("jobs:list:version");
};

export const createJob = async (clientId: string, data: ICreateJob) => {
  const { skills, ...jobData } = data;
  const skillRecords = await Promise.all(
    skills.map((name) => findOrCreateSkill(name)),
  );

  const job = await prisma.job.create({
    data: {
      ...jobData,
      clientId,
      status: "DRAFT",
      skills: { create: skillRecords.map((skill) => ({ skillId: skill.id })) },
    },
    include: includeJobDetails,
  });

  await invalidateJobListCache();
  return toJobResponse(job);
};

export const updateJob = async (
  jobId: string,
  currentUser: JwtPayload,
  data: IUpdateJob,
) => {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Job not found");
  checkOwnership(job.clientId, currentUser);

  if (!EDITABLE_JOB_STATUSES.includes(job.status)) {
    throw new ApiError(400, `Cannot edit a job with status ${job.status}`);
  }

  const { skills, ...jobData } = data;

  if (skills) {
    const skillRecords = await Promise.all(
      skills.map((name) => findOrCreateSkill(name)),
    );
    await prisma.jobSkill.deleteMany({ where: { jobId } });
    await prisma.jobSkill.createMany({
      data: skillRecords.map((skill) => ({ jobId, skillId: skill.id })),
    });
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: jobData,
    include: includeJobDetails,
  });
  await invalidateJobListCache();
  return toJobResponse(updated);
};

export const updateJobStatus = async (
  jobId: string,
  currentUser: JwtPayload,
  newStatus: JobStatus,
) => {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Job not found");
  checkOwnership(job.clientId, currentUser);

  const allowedNext = JOB_STATUS_TRANSITIONS[job.status];
  if (!allowedNext.includes(newStatus)) {
    throw new ApiError(
      400,
      `Cannot change status from ${job.status} to ${newStatus}`,
    );
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: newStatus },
    include: includeJobDetails,
  });
  await invalidateJobListCache();
  return toJobResponse(updated);
};

export const deleteJob = async (jobId: string, currentUser: JwtPayload) => {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Job not found");
  checkOwnership(job.clientId, currentUser);

  if (job.status !== "DRAFT") {
    throw new ApiError(
      400,
      "Only draft jobs can be deleted. Cancel published jobs instead.",
    );
  }

  await prisma.job.delete({ where: { id: jobId } });
  await invalidateJobListCache();
};

// `user` is optional so internal callers (application.service) keep working unchanged.
export const getJobById = async (jobId: string, user?: JwtPayload) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: includeJobDetails,
  });
  if (!job) throw new ApiError(404, "Job not found");

  const { saved, applied } = await getJobFlagSets(user, [job.id]);
  return toJobResponse(job, {
    isSaved: saved.has(job.id),
    hasApplied: applied.has(job.id),
  });
};

export const listJobs = async (query: IJobListQuery, user?: JwtPayload) => {
  const cacheKey = await getJobListCacheKey(query);
  const cached = await redisService.get(cacheKey);

  let base: { jobs: JobResponse[]; meta: ReturnType<typeof buildMeta> };

  if (cached) {
    base = JSON.parse(cached);
  } else {
    const { skip, take, page, limit } = getPagination(query);

    const where: Prisma.JobWhereInput = {
      status: "OPEN",
      ...(query.category && { category: query.category }),
      ...(query.budgetType && { budgetType: query.budgetType }),
      ...(query.experienceLevel && { experienceLevel: query.experienceLevel }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      }),
      ...(query.minBudget !== undefined && {
        budgetMax: { gte: query.minBudget },
      }),
      ...(query.maxBudget !== undefined && {
        budgetMin: { lte: query.maxBudget },
      }),
    };

    const orderBy: Prisma.JobOrderByWithRelationInput =
      query.sortBy === "budget_asc"
        ? { budgetMin: "asc" }
        : query.sortBy === "budget_desc"
          ? { budgetMax: "desc" }
          : { createdAt: "desc" };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy,
        skip,
        take,
        include: includeJobDetails,
      }),
      prisma.job.count({ where }),
    ]);

    base = {
      jobs: jobs.map((job) => toJobResponse(job)),
      meta: buildMeta(total, page, limit),
    };
    await redisService.set(cacheKey, JSON.stringify(base), JOB_LIST_CACHE_TTL);
  }

  return { jobs: await withUserFlags(base.jobs, user), meta: base.meta };
};

export const listMyJobs = async (
  clientId: string,
  query: IJobListQuery & { status?: JobStatus },
) => {
  const { skip, take, page, limit } = getPagination(query);
  const where: Prisma.JobWhereInput = {
    clientId,
    ...(query.status && { status: query.status }),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: includeJobDetails,
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs: jobs.map((job) => toJobResponse(job)),
    meta: buildMeta(total, page, limit),
  };
};

export const saveJob = async (userId: string, jobId: string) => {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Job not found");

  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (existing) throw new ApiError(409, "Job already saved");

  return prisma.savedJob.create({ data: { userId, jobId } });
};

export const unsaveJob = async (userId: string, jobId: string) => {
  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (!existing) throw new ApiError(404, "Job is not saved");
  await prisma.savedJob.delete({ where: { userId_jobId: { userId, jobId } } });
};

export const listSavedJobs = async (userId: string, query: IJobListQuery) => {
  const { skip, take, page, limit } = getPagination(query);

  const [savedRows, total] = await Promise.all([
    prisma.savedJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { job: { include: includeJobDetails } },
    }),
    prisma.savedJob.count({ where: { userId } }),
  ]);

  const appliedRows = await prisma.application.findMany({
    where: {
      freelancerId: userId,
      jobId: { in: savedRows.map((row) => row.jobId) },
    },
    select: { jobId: true },
  });
  const appliedIds = new Set(appliedRows.map((row) => row.jobId));

  const jobs = savedRows.map((row) => ({
    ...toJobResponse(row.job, {
      isSaved: true,
      hasApplied: appliedIds.has(row.jobId),
    }),
    savedAt: row.createdAt,
  }));

  return { jobs, meta: buildMeta(total, page, limit) };
};

export const isJobOpenForApplications = (status: JobStatus): boolean =>
  status === "OPEN";
