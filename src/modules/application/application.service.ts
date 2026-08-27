import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { getJobById, isJobOpenForApplications } from "../job/job.service";
import {
  APPLICATION_STATUS_TRANSITIONS,
  CLIENT_ALLOWED_TARGET_STATUSES,
  WITHDRAWABLE_STATUSES,
} from "./application.constants";
import {
  ICreateApplication,
  IApplicationListQuery,
} from "./application.interface";
import { ApplicationStatus, Prisma } from "../../../generated/prisma/client";

const includeApplicationDetails = {
  job: { select: { id: true, title: true, status: true, clientId: true } },
  freelancer: {
    select: {
      id: true,
      name: true,
      freelancerProfile: { select: { title: true, hourlyRate: true } },
    },
  },
};

export const createApplication = async (
  freelancerId: string,
  data: ICreateApplication
) => {
  const job = await getJobById(data.jobId);

  if (!isJobOpenForApplications(job.status)) {
    throw new ApiError(400, "This job is not currently accepting applications");
  }

  const existing = await prisma.application.findUnique({
    where: { jobId_freelancerId: { jobId: data.jobId, freelancerId } },
  });
  if (existing) {
    throw new ApiError(409, "You have already applied to this job");
  }

  return prisma.application.create({
    data: {
      jobId: data.jobId,
      freelancerId,
      coverLetter: data.coverLetter,
      proposedBudget: data.proposedBudget,
      estimatedDeliveryDays: data.estimatedDeliveryDays,
    },
    include: includeApplicationDetails,
  });
};

export const getApplicationById = async (
  applicationId: string,
  currentUser: JwtPayload
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: includeApplicationDetails,
  });
  if (!application) throw new ApiError(404, "Application not found");

  // Either the applicant or the job's client may view it — not just the applicant.
  const isFreelancerOwner = application.freelancerId === currentUser.userId;
  const isClientOwner = application.job.clientId === currentUser.userId;
  if (!isFreelancerOwner && !isClientOwner && currentUser.role !== "ADMIN") {
    throw new ApiError(
      403,
      "You do not have permission to view this application"
    );
  }

  return application;
};

export const listMyApplications = async (
  freelancerId: string,
  query: IApplicationListQuery
) => {
  const { skip, take, page, limit } = getPagination(query);
  const where: Prisma.ApplicationWhereInput = {
    freelancerId,
    ...(query.status && { status: query.status }),
  };

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: includeApplicationDetails,
    }),
    prisma.application.count({ where }),
  ]);

  return { applications, meta: buildMeta(total, page, limit) };
};

export const listApplicationsForJob = async (
  jobId: string,
  currentUser: JwtPayload,
  query: IApplicationListQuery
) => {
  const job = await getJobById(jobId);
  checkOwnership(job.clientId, currentUser);

  const { skip, take, page, limit } = getPagination(query);
  const where: Prisma.ApplicationWhereInput = {
    jobId,
    ...(query.status && { status: query.status }),
  };

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: includeApplicationDetails,
    }),
    prisma.application.count({ where }),
  ]);

  return { applications, meta: buildMeta(total, page, limit) };
};

export const updateApplicationStatus = async (
  applicationId: string,
  currentUser: JwtPayload,
  newStatus: ApplicationStatus
) => {
  if (!CLIENT_ALLOWED_TARGET_STATUSES.includes(newStatus)) {
    throw new ApiError(
      400,
      `Clients cannot set application status directly to ${newStatus}`
    );
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });
  if (!application) throw new ApiError(404, "Application not found");
  checkOwnership(application.job.clientId, currentUser);

  const allowedNext = APPLICATION_STATUS_TRANSITIONS[application.status];
  if (!allowedNext.includes(newStatus)) {
    throw new ApiError(
      400,
      `Cannot change status from ${application.status} to ${newStatus}`
    );
  }

  return prisma.application.update({
    where: { id: applicationId },
    data: { status: newStatus },
    include: includeApplicationDetails,
  });
};

export const withdrawApplication = async (
  applicationId: string,
  currentUser: JwtPayload
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new ApiError(404, "Application not found");
  checkOwnership(application.freelancerId, currentUser);

  if (!WITHDRAWABLE_STATUSES.includes(application.status)) {
    throw new ApiError(
      400,
      `Cannot withdraw an application with status ${application.status}`
    );
  }

  return prisma.application.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN" },
  });
};

// Exported for Phase 9's hiring flow — hiring transitions an application to
// HIRED as part of a larger Prisma transaction (application + job + contract
// all updated together), so it deliberately isn't wired to a route here.
export const markApplicationAsHired = async (applicationId: string) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new ApiError(404, "Application not found");

  const allowedNext = APPLICATION_STATUS_TRANSITIONS[application.status];
  if (!allowedNext.includes("HIRED")) {
    throw new ApiError(
      400,
      `Cannot hire from application status ${application.status}`
    );
  }

  return application; // Phase 9 performs the actual update inside its own transaction
};
