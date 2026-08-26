import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { findOrCreateSkill } from "../skill/skill.service";
import { getPagination, buildMeta } from "../../utils/pagination";
import { JOB_STATUS_TRANSITIONS, EDITABLE_JOB_STATUSES } from "./job.constants";
import { ICreateJob, IUpdateJob, IJobListQuery } from "./job.interface";
import { JobStatus, Prisma } from "../../../generated/prisma/client";

const includeJobDetails = {
  skills: { include: { skill: true } },
  client: {
    select: {
      id: true,
      name: true,
      clientProfile: { select: { companyName: true } },
    },
  },
};

export const createJob = async (clientId: string, data: ICreateJob) => {
  const { skills, ...jobData } = data;
  const skillRecords = await Promise.all(
    skills.map((name) => findOrCreateSkill(name))
  );

  return prisma.job.create({
    data: {
      ...jobData,
      clientId,
      status: "DRAFT",
      skills: { create: skillRecords.map((skill) => ({ skillId: skill.id })) },
    },
    include: includeJobDetails,
  });
};

export const updateJob = async (
  jobId: string,
  currentUser: JwtPayload,
  data: IUpdateJob
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
      skills.map((name) => findOrCreateSkill(name))
    );
    await prisma.jobSkill.deleteMany({ where: { jobId } });
    await prisma.jobSkill.createMany({
      data: skillRecords.map((skill) => ({ jobId, skillId: skill.id })),
    });
  }

  return prisma.job.update({
    where: { id: jobId },
    data: jobData,
    include: includeJobDetails,
  });
};

export const updateJobStatus = async (
  jobId: string,
  currentUser: JwtPayload,
  newStatus: JobStatus
) => {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Job not found");
  checkOwnership(job.clientId, currentUser);

  const allowedNext = JOB_STATUS_TRANSITIONS[job.status];
  if (!allowedNext.includes(newStatus)) {
    throw new ApiError(
      400,
      `Cannot change status from ${job.status} to ${newStatus}`
    );
  }

  return prisma.job.update({
    where: { id: jobId },
    data: { status: newStatus },
  });
};

export const deleteJob = async (jobId: string, currentUser: JwtPayload) => {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Job not found");
  checkOwnership(job.clientId, currentUser);

  if (job.status !== "DRAFT") {
    throw new ApiError(
      400,
      "Only draft jobs can be deleted. Cancel published jobs instead."
    );
  }

  await prisma.job.delete({ where: { id: jobId } });
};

export const getJobById = async (jobId: string) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: includeJobDetails,
  });
  if (!job) throw new ApiError(404, "Job not found");
  return job;
};

export const listJobs = async (query: IJobListQuery) => {
  const { skip, take, page, limit } = getPagination(query);

  const where: Prisma.JobWhereInput = {
    status: "OPEN", // public listing only ever shows actively open jobs
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

  return { jobs, meta: buildMeta(total, page, limit) };
};

export const listMyJobs = async (
  clientId: string,
  query: IJobListQuery & { status?: JobStatus }
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

  return { jobs, meta: buildMeta(total, page, limit) };
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

  const [savedJobs, total] = await Promise.all([
    prisma.savedJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { job: { include: includeJobDetails } },
    }),
    prisma.savedJob.count({ where: { userId } }),
  ]);

  return { savedJobs, meta: buildMeta(total, page, limit) };
};

// Exported for Phase 8 — the Application module will call this before
// allowing a proposal to be submitted, per your rule: "Closed jobs cannot
// receive applications."
export const isJobOpenForApplications = (status: JobStatus): boolean =>
  status === "OPEN";
