import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import redisService from "../../utils/redisService";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { logAdminAction } from "../../utils/adminAudit";
import {
  ContractStatus,
  JobStatus,
  Prisma,
  Role,
} from "../../../generated/prisma";
import {
  EARNED_CONTRACT_STATUSES,
  ESCROW_CONTRACT_STATUSES,
} from "../payment/payment.constants";
import {
  IAdminJobListQuery,
  IAdminUserListQuery,
  IForceCloseJob,
  ISuspendUser,
} from "./admin.interface";

const ROLES = [
  "CLIENT",
  "FREELANCER",
  "ADMIN",
] as const satisfies readonly Role[];
const JOB_STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
] as const satisfies readonly JobStatus[];
const CONTRACT_STATUSES = [
  "PENDING",
  "ACTIVE",
  "SUBMITTED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const satisfies readonly ContractStatus[];

// Turns groupBy rows into { total, byStatus } with every key present (zero-filled).
// dashboard.service keeps its own private copy of this helper.
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

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isVerified: true,
  isSuspended: true,
  provider: true,
  imageUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const adminJobInclude = {
  client: { select: { id: true, name: true, imageUrl: true, email: true } },
  _count: {
    select: { applications: { where: { status: { not: "WITHDRAWN" } } } },
  },
} satisfies Prisma.JobInclude;

type AdminJob = Prisma.JobGetPayload<{ include: typeof adminJobInclude }>;

const toAdminJobView = (job: AdminJob) => ({
  id: job.id,
  title: job.title,
  status: job.status,
  category: job.category,
  budgetType: job.budgetType,
  budgetMin: Number(job.budgetMin),
  budgetMax: Number(job.budgetMax),
  createdAt: job.createdAt,
  client: job.client,
  applicantCount: job._count.applications,
});

export const getAdminStats = async () => {
  const [
    userRows,
    suspendedUsers,
    jobRows,
    contractRows,
    openDisputes,
    completedMoney,
    escrowMoney,
    refundedMoney,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { deletedAt: null, isSuspended: true } }),
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.contract.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
        contract: { status: { in: EARNED_CONTRACT_STATUSES } },
      },
      _sum: { amount: true, feeAmount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
        contract: { status: { in: ESCROW_CONTRACT_STATUSES } },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "REFUNDED" },
      _sum: { amount: true },
    }),
  ]);

  return {
    users: {
      ...toStatusCounts(
        ROLES,
        userRows.map((row) => ({ status: row.role, _count: row._count })),
      ),
      suspended: suspendedUsers,
    },
    jobs: toStatusCounts(JOB_STATUSES, jobRows),
    contracts: toStatusCounts(CONTRACT_STATUSES, contractRows),
    disputes: { open: openDisputes },
    // Gross money in USD. Only SUCCESS payments count; REFUNDED is reported separately.
    revenue: {
      totalRevenue: Number(completedMoney._sum.amount ?? 0),
      platformFees: Number(completedMoney._sum.feeAmount ?? 0),
      inEscrow: Number(escrowMoney._sum.amount ?? 0),
      refunded: Number(refundedMoney._sum.amount ?? 0),
    },
  };
};

export const listUsers = async (query: IAdminUserListQuery) => {
  const { skip, take, page, limit } = getPagination(query);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role && { role: query.role }),
    ...(query.isVerified !== undefined && { isVerified: query.isVerified }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take,
      select: adminUserSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: buildMeta(total, page, limit) };
};

export const setUserSuspension = async (
  admin: JwtPayload,
  targetUserId: string,
  input: ISuspendUser,
) => {
  if (targetUserId === admin.userId) {
    throw new ApiError(400, "You can't suspend your own account");
  }

  const user = await prisma.user.findFirst({
    where: { id: targetUserId, deletedAt: null },
    select: { id: true, role: true, isSuspended: true },
  });
  if (!user) throw new ApiError(404, "User not found");
  if (user.role === "ADMIN") {
    throw new ApiError(403, "Admin accounts can't be suspended");
  }
  if (user.isSuspended === input.suspended) {
    throw new ApiError(
      409,
      input.suspended
        ? "This user is already suspended"
        : "This user is not suspended",
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { isSuspended: input.suspended },
      select: adminUserSelect,
    }),
    logAdminAction(prisma, {
      adminId: admin.userId,
      action: input.suspended ? "USER_SUSPENDED" : "USER_UNSUSPENDED",
      targetType: "USER",
      targetId: targetUserId,
      note: input.reason || null,
    }),
  ]);

  return updated;
};

export const listJobs = async (query: IAdminJobListQuery) => {
  const { skip, take, page, limit } = getPagination(query);

  const where: Prisma.JobWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { client: { name: { contains: query.search, mode: "insensitive" } } },
      ],
    }),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take,
      include: adminJobInclude,
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs: jobs.map(toAdminJobView),
    meta: buildMeta(total, page, limit),
  };
};

export const forceCloseJob = async (
  admin: JwtPayload,
  jobId: string,
  input: IForceCloseJob,
) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, status: true },
  });
  if (!job) throw new ApiError(404, "Job not found");

  if (job.status === "IN_PROGRESS") {
    throw new ApiError(
      400,
      "This job has an active contract. Resolve the contract or dispute first.",
    );
  }
  if (job.status !== "DRAFT" && job.status !== "OPEN") {
    throw new ApiError(400, `Cannot close a job with status ${job.status}`);
  }

  const [updated] = await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: { status: input.status },
      include: adminJobInclude,
    }),
    logAdminAction(prisma, {
      adminId: admin.userId,
      action: "JOB_FORCE_CLOSED",
      targetType: "JOB",
      targetId: jobId,
      note: [input.status, input.note].filter(Boolean).join(": "),
    }),
  ]);

  // Bumps the same counter job.service uses to invalidate the public job list.
  // If this ever fails, the list cache's 60-second TTL is the fallback.
  await redisService.increment("jobs:list:version");

  return toAdminJobView(updated);
};
