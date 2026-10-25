// src/modules/dashboard/dashboard.service.ts  (NEW)
import prisma from "../../config/prismaClient";
import {
  ApplicationStatus,
  ContractStatus,
  JobStatus,
} from "../../../generated/prisma";
import { calculateProfileCompletion } from "../freelancer-profile/freelancer-profile.utils";
import {
  getFreelancerEarningsSummary,
  getClientSpendingSummary,
} from "../payment/payment.service";

const APPLICATION_STATUSES = [
  "PENDING",
  "SHORTLISTED",
  "REJECTED",
  "HIRED",
  "WITHDRAWN",
] as const satisfies readonly ApplicationStatus[];
const CONTRACT_STATUSES = [
  "PENDING",
  "ACTIVE",
  "SUBMITTED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const satisfies readonly ContractStatus[];
const JOB_STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
] as const satisfies readonly JobStatus[];

// Turns groupBy rows into { total, byStatus } with every status present (zero-filled),
// so the frontend never has to guard against missing keys.
const toStatusCounts = <S extends string>(
  statuses: readonly S[],
  rows: { status: S; _count: { _all: number } }[],
) => {
  const byStatus = Object.fromEntries(
    statuses.map((status) => [status, 0]),
  ) as Record<S, number>;
  for (const row of rows) byStatus[row.status] = row._count._all;

  return {
    total: rows.reduce((sum, row) => sum + row._count._all, 0),
    byStatus,
  };
};

export const getFreelancerStats = async (userId: string) => {
  const [
    applicationRows,
    contractRows,
    savedJobs,
    unreadNotifications,
    profile,
    earnings,
  ] = await Promise.all([
    prisma.application.groupBy({
      by: ["status"],
      where: { freelancerId: userId },
      _count: { _all: true },
    }),
    prisma.contract.groupBy({
      by: ["status"],
      where: { freelancerId: userId },
      _count: { _all: true },
    }),
    prisma.savedJob.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.freelancerProfile.findUnique({
      where: { userId },
      select: {
        title: true,
        bio: true,
        hourlyRate: true,
        experienceLevel: true,
        _count: {
          select: { skills: true, experiences: true, portfolios: true },
        },
      },
    }),
    getFreelancerEarningsSummary(userId),
  ]);

  return {
    applications: toStatusCounts(APPLICATION_STATUSES, applicationRows),
    contracts: toStatusCounts(CONTRACT_STATUSES, contractRows),
    savedJobs,
    unreadNotifications,
    profile: {
      hasProfile: profile !== null,
      completionPercentage: profile
        ? calculateProfileCompletion({
            title: profile.title,
            bio: profile.bio,
            hourlyRate: profile.hourlyRate,
            experienceLevel: profile.experienceLevel,
            skillCount: profile._count.skills,
            experienceCount: profile._count.experiences,
            portfolioCount: profile._count.portfolios,
          })
        : 0,
    },
    earnings,
  };
};

export const getClientStats = async (clientId: string) => {
  const [
    jobRows,
    totalApplicants,
    contractRows,
    spending,
    unreadNotifications,
  ] = await Promise.all([
    prisma.job.groupBy({
      by: ["status"],
      where: { clientId },
      _count: { _all: true },
    }),
    // Withdrawn applications don't count, same rule as applicantCount on jobs.
    prisma.application.count({
      where: { job: { clientId }, status: { not: "WITHDRAWN" } },
    }),
    prisma.contract.groupBy({
      by: ["status"],
      where: { clientId },
      _count: { _all: true },
    }),
    getClientSpendingSummary(clientId),
    prisma.notification.count({ where: { userId: clientId, isRead: false } }),
  ]);

  return {
    jobs: toStatusCounts(JOB_STATUSES, jobRows),
    totalApplicants,
    contracts: toStatusCounts(CONTRACT_STATUSES, contractRows),
    spending,
    unreadNotifications,
  };
};
