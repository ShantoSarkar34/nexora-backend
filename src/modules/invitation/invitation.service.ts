import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { InvitationStatus, JobStatus, Prisma } from "../../../generated/prisma";
import { notifyUser } from "../notification/notification.service";
import {
  ICreateInvitation,
  IInvitationListQuery,
} from "./invitation.interface";

const invitationInclude = {
  job: {
    select: {
      id: true,
      title: true,
      status: true,
      budgetType: true,
      budgetMin: true,
      budgetMax: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      clientProfile: { select: { companyName: true } },
    },
  },
  freelancer: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      freelancerProfile: { select: { title: true } },
    },
  },
} satisfies Prisma.InvitationInclude;

type InvitationWithDetails = Prisma.InvitationGetPayload<{
  include: typeof invitationInclude;
}>;

// EXPIRED is never stored. A PENDING invitation whose job is no longer OPEN
// reads as EXPIRED, so no cron job is needed.
const getEffectiveStatus = (invitation: {
  status: InvitationStatus;
  job: { status: JobStatus };
}): InvitationStatus =>
  invitation.status === "PENDING" && invitation.job.status !== "OPEN"
    ? "EXPIRED"
    : invitation.status;

const toJobSummary = (job: InvitationWithDetails["job"]) => ({
  id: job.id,
  title: job.title,
  budgetMin: Number(job.budgetMin),
  budgetMax: Number(job.budgetMax),
  budgetType: job.budgetType,
  status: job.status,
});

// pendingKey is intentionally left out of every view.
const toBaseView = (invitation: InvitationWithDetails) => ({
  id: invitation.id,
  jobId: invitation.jobId,
  message: invitation.message,
  status: getEffectiveStatus(invitation),
  createdAt: invitation.createdAt,
  respondedAt: invitation.respondedAt,
  job: toJobSummary(invitation.job),
});

const toFreelancerView = (invitation: InvitationWithDetails) => ({
  ...toBaseView(invitation),
  client: {
    id: invitation.client.id,
    name: invitation.client.name,
    imageUrl: invitation.client.imageUrl,
    companyName: invitation.client.clientProfile?.companyName ?? null,
  },
});

const toClientView = (invitation: InvitationWithDetails) => ({
  ...toBaseView(invitation),
  freelancer: {
    id: invitation.freelancer.id,
    name: invitation.freelancer.name,
    imageUrl: invitation.freelancer.imageUrl,
    title: invitation.freelancer.freelancerProfile?.title ?? null,
  },
});

// The status filters follow the effective status: PENDING means "pending and
// the job is still open", EXPIRED means "pending but the job is closed".
const buildStatusFilter = (
  status?: InvitationStatus,
): Prisma.InvitationWhereInput => {
  if (!status) return {};
  if (status === "PENDING")
    return { status: "PENDING", job: { status: "OPEN" } };
  if (status === "EXPIRED")
    return { status: "PENDING", job: { status: { not: "OPEN" } } };
  return { status };
};

const assertActionable = (invitation: InvitationWithDetails): void => {
  const status = getEffectiveStatus(invitation);
  if (status === "EXPIRED") {
    throw new ApiError(
      400,
      "This invitation has expired because the job is no longer open",
    );
  }
  if (status !== "PENDING") {
    throw new ApiError(
      400,
      `Cannot change an invitation with status ${status}`,
    );
  }
};

// Conditional update: only one of two racing actions (respond vs cancel) can win.
const claimPendingInvitation = async (
  invitationId: string,
  data: { status: "ACCEPTED" | "DECLINED" | "CANCELLED"; respondedAt?: Date },
): Promise<void> => {
  const result = await prisma.invitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { ...data, pendingKey: null },
  });
  if (result.count === 0) {
    throw new ApiError(
      409,
      "This invitation has already been answered or cancelled",
    );
  }
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const createInvitation = async (
  currentUser: JwtPayload,
  input: ICreateInvitation,
) => {
  const job = await prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job) throw new ApiError(404, "Job not found");
  checkOwnership(job.clientId, currentUser);

  if (job.status !== "OPEN") {
    throw new ApiError(400, "Only open jobs can receive invitations");
  }

  const freelancer = await prisma.user.findFirst({
    where: { id: input.freelancerId, role: "FREELANCER", deletedAt: null },
    select: { id: true, freelancerProfile: { select: { id: true } } },
  });
  if (!freelancer) throw new ApiError(404, "Freelancer not found");
  if (!freelancer.freelancerProfile) {
    throw new ApiError(400, "This freelancer hasn't created a profile yet");
  }

  // Any application counts, including a withdrawn one (re-applying is blocked).
  const existingApplication = await prisma.application.findUnique({
    where: {
      jobId_freelancerId: { jobId: job.id, freelancerId: freelancer.id },
    },
    select: { id: true },
  });
  if (existingApplication) {
    throw new ApiError(409, "This freelancer has already applied to this job");
  }

  const duplicateMessage =
    "You have already invited this freelancer to this job";
  const existingPending = await prisma.invitation.findFirst({
    where: { jobId: job.id, freelancerId: freelancer.id, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) throw new ApiError(409, duplicateMessage);

  const invitation = await prisma.invitation
    .create({
      data: {
        jobId: job.id,
        clientId: currentUser.userId,
        freelancerId: freelancer.id,
        message: input.message?.trim() || null,
        status: "PENDING",
        pendingKey: `${job.id}:${freelancer.id}`,
      },
      include: invitationInclude,
    })
    .catch((error: unknown) => {
      // Two simultaneous requests: the unique pendingKey lets only one through.
      if (isUniqueViolation(error)) throw new ApiError(409, duplicateMessage);
      throw error;
    });

  await notifyUser({
    userId: freelancer.id,
    type: "NEW_INVITATION",
    title: "You've been invited to a job",
    message: `${invitation.client.name} invited you to apply for "${job.title}"`,
    link: `/jobs/${job.id}`,
    entityType: "INVITATION",
    entityId: invitation.id,
    meta: { jobId: job.id },
  });

  return toClientView(invitation);
};

export const listMyInvitations = async (
  freelancerId: string,
  query: IInvitationListQuery,
) => {
  const { skip, take, page, limit } = getPagination(query);
  const where: Prisma.InvitationWhereInput = {
    freelancerId,
    ...buildStatusFilter(query.status),
  };

  const [invitations, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: invitationInclude,
    }),
    prisma.invitation.count({ where }),
  ]);

  return {
    invitations: invitations.map(toFreelancerView),
    meta: buildMeta(total, page, limit),
  };
};

export const listSentInvitations = async (
  clientId: string,
  query: IInvitationListQuery,
) => {
  const { skip, take, page, limit } = getPagination(query);
  // clientId is always in the filter, so another client's jobId simply returns nothing.
  const where: Prisma.InvitationWhereInput = {
    clientId,
    ...(query.jobId && { jobId: query.jobId }),
    ...buildStatusFilter(query.status),
  };

  const [invitations, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: invitationInclude,
    }),
    prisma.invitation.count({ where }),
  ]);

  return {
    invitations: invitations.map(toClientView),
    meta: buildMeta(total, page, limit),
  };
};

export const respondToInvitation = async (
  invitationId: string,
  currentUser: JwtPayload,
  status: "ACCEPTED" | "DECLINED",
) => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: invitationInclude,
  });
  if (!invitation) throw new ApiError(404, "Invitation not found");
  checkOwnership(invitation.freelancerId, currentUser);
  assertActionable(invitation);

  // ACCEPTED deliberately does not create an application: that needs a cover
  // letter, so the freelancer applies as a separate step.
  const respondedAt = new Date();
  await claimPendingInvitation(invitationId, { status, respondedAt });

  const accepted = status === "ACCEPTED";
  await notifyUser({
    userId: invitation.clientId,
    type: accepted ? "INVITATION_ACCEPTED" : "INVITATION_DECLINED",
    title: accepted ? "Invitation accepted" : "Invitation declined",
    message: `${invitation.freelancer.name} ${accepted ? "accepted" : "declined"} your invitation to "${invitation.job.title}"`,
    link: `/jobs/${invitation.jobId}`,
    entityType: "INVITATION",
    entityId: invitation.id,
    meta: { jobId: invitation.jobId },
  });

  return toFreelancerView({ ...invitation, status, respondedAt });
};

export const cancelInvitation = async (
  invitationId: string,
  currentUser: JwtPayload,
) => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: invitationInclude,
  });
  if (!invitation) throw new ApiError(404, "Invitation not found");
  checkOwnership(invitation.clientId, currentUser);
  assertActionable(invitation);

  await claimPendingInvitation(invitationId, { status: "CANCELLED" });

  return toClientView({ ...invitation, status: "CANCELLED" });
};

// Returned un-awaited on purpose: createApplication runs it inside the same
// $transaction as the application insert, so a pending invitation is only
// marked ACCEPTED if the application is really created.
export const acceptPendingInvitationOp = (
  jobId: string,
  freelancerId: string,
) =>
  prisma.invitation.updateMany({
    where: { jobId, freelancerId, status: "PENDING" },
    data: { status: "ACCEPTED", respondedAt: new Date(), pendingKey: null },
  });
