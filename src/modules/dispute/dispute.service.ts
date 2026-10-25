import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { logAdminAction } from "../../utils/adminAudit";
import { stripe } from "../../config/stripeClient";
import {
  ContractStatus,
  DisputeResolution,
  Prisma,
  RefundStatus,
} from "../../../generated/prisma";
import { notifyUser } from "../notification/notification.service";
import { IDisputeListQuery, IResolveDispute } from "./dispute.interface";

const DISPUTABLE_CONTRACT_STATUSES: ContractStatus[] = ["ACTIVE", "SUBMITTED"];

const disputeInclude = {
  openedBy: { select: { id: true, name: true, imageUrl: true } },
  resolvedBy: { select: { id: true, name: true } },
  contract: {
    select: {
      id: true,
      status: true,
      agreedBudget: true,
      clientId: true,
      freelancerId: true,
      job: { select: { id: true, title: true } },
      client: { select: { id: true, name: true, imageUrl: true } },
      freelancer: { select: { id: true, name: true, imageUrl: true } },
    },
  },
} satisfies Prisma.DisputeInclude;

type DisputeWithDetails = Prisma.DisputeGetPayload<{
  include: typeof disputeInclude;
}>;

const toParticipantView = (dispute: DisputeWithDetails) => ({
  id: dispute.id,
  contractId: dispute.contractId,
  status: dispute.status,
  reason: dispute.reason,
  previousContractStatus: dispute.previousContractStatus,
  resolution: dispute.resolution,
  resolutionNote: dispute.resolutionNote,
  refundStatus: dispute.refundStatus,
  resolvedAt: dispute.resolvedAt,
  createdAt: dispute.createdAt,
  updatedAt: dispute.updatedAt,
  openedBy: dispute.openedBy,
  contract: {
    id: dispute.contract.id,
    status: dispute.contract.status,
    agreedBudget: Number(dispute.contract.agreedBudget),
    job: dispute.contract.job,
    client: dispute.contract.client,
    freelancer: dispute.contract.freelancer,
  },
});

// Admins additionally see who resolved it and the raw Stripe refund details.
const toAdminView = (dispute: DisputeWithDetails) => ({
  ...toParticipantView(dispute),
  resolvedBy: dispute.resolvedBy,
  refund:
    dispute.resolution === "REFUND_CLIENT"
      ? { stripeRefundId: dispute.stripeRefundId, error: dispute.refundError }
      : null,
});

const isParticipant = (dispute: DisputeWithDetails, userId: string) =>
  dispute.contract.clientId === userId ||
  dispute.contract.freelancerId === userId;

const notifyBothParties = async (
  dispute: DisputeWithDetails,
  type: "DISPUTE_OPENED" | "DISPUTE_RESOLVED",
  build: (recipientId: string) => { title: string; message: string },
): Promise<void> => {
  for (const userId of [
    dispute.contract.clientId,
    dispute.contract.freelancerId,
  ]) {
    const { title, message } = build(userId);
    await notifyUser({
      userId,
      type,
      title,
      message,
      link: `/disputes/${dispute.id}`,
      entityType: "DISPUTE",
      entityId: dispute.id,
      meta: { contractId: dispute.contractId, jobId: dispute.contract.job.id },
    });
  }
};

export const openDispute = async (
  contractId: string,
  viewer: JwtPayload,
  reason: string,
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");

  if (
    contract.clientId !== viewer.userId &&
    contract.freelancerId !== viewer.userId
  ) {
    throw new ApiError(403, "You are not a participant in this contract");
  }

  if (contract.status === "DISPUTED") {
    throw new ApiError(409, "This contract is already under dispute");
  }
  if (!DISPUTABLE_CONTRACT_STATUSES.includes(contract.status)) {
    throw new ApiError(
      400,
      `Disputes can only be opened on ACTIVE or SUBMITTED contracts (current status: ${contract.status})`,
    );
  }

  const dispute = await prisma.$transaction(async (tx) => {
    // Claim against the exact status we just read: two simultaneous requests can't both
    // win, and previousContractStatus is guaranteed to be what the contract really was.
    const claimed = await tx.contract.updateMany({
      where: { id: contractId, status: contract.status },
      data: { status: "DISPUTED" },
    });
    if (claimed.count === 0) {
      throw new ApiError(
        409,
        "The contract changed while opening the dispute. Please try again.",
      );
    }

    return tx.dispute.create({
      data: {
        contractId,
        openedById: viewer.userId,
        reason: reason.trim(),
        previousContractStatus: contract.status,
      },
      include: disputeInclude,
    });
  });

  await notifyBothParties(dispute, "DISPUTE_OPENED", (recipientId) =>
    recipientId === viewer.userId
      ? {
          title: "Dispute submitted",
          message: `Your dispute on "${dispute.contract.job.title}" was submitted. An admin will review it.`,
        }
      : {
          title: "A dispute was opened",
          message: `${dispute.openedBy.name} opened a dispute on "${dispute.contract.job.title}". An admin will review it.`,
        },
  );

  return toParticipantView(dispute);
};

export const listMyDisputes = async (
  viewer: JwtPayload,
  query: IDisputeListQuery,
) => {
  const { skip, take, page, limit } = getPagination(query);

  const where: Prisma.DisputeWhereInput = {
    contract:
      viewer.role === "CLIENT"
        ? { clientId: viewer.userId }
        : { freelancerId: viewer.userId },
    ...(query.status && { status: query.status }),
    ...(query.contractId && { contractId: query.contractId }),
  };

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: disputeInclude,
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    disputes: disputes.map(toParticipantView),
    meta: buildMeta(total, page, limit),
  };
};

export const getDisputeById = async (disputeId: string, viewer: JwtPayload) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: disputeInclude,
  });
  if (!dispute) throw new ApiError(404, "Dispute not found");

  if (viewer.role === "ADMIN") return toAdminView(dispute);

  if (!isParticipant(dispute, viewer.userId)) {
    throw new ApiError(403, "You are not a participant in this dispute");
  }
  return toParticipantView(dispute);
};

export const withdrawDispute = async (
  disputeId: string,
  viewer: JwtPayload,
) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: disputeInclude,
  });
  if (!dispute) throw new ApiError(404, "Dispute not found");
  checkOwnership(dispute.openedById, viewer);

  if (dispute.status !== "OPEN") {
    throw new ApiError(
      400,
      `Cannot withdraw a dispute with status ${dispute.status}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: { status: "WITHDRAWN" },
    });
    if (claimed.count === 0)
      throw new ApiError(409, "This dispute is no longer open");

    const restored = await tx.contract.updateMany({
      where: { id: dispute.contractId, status: "DISPUTED" },
      data: { status: dispute.previousContractStatus },
    });
    if (restored.count === 0)
      throw new ApiError(409, "The contract is no longer under dispute");
  });

  const otherPartyId =
    dispute.contract.clientId === dispute.openedById
      ? dispute.contract.freelancerId
      : dispute.contract.clientId;
  await notifyUser({
    userId: otherPartyId,
    type: "DISPUTE_RESOLVED",
    title: "Dispute withdrawn",
    message: `${dispute.openedBy.name} withdrew the dispute on "${dispute.contract.job.title}". The contract is active again.`,
    link: `/disputes/${dispute.id}`,
    entityType: "DISPUTE",
    entityId: dispute.id,
    meta: { contractId: dispute.contractId, jobId: dispute.contract.job.id },
  });

  const updated = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: disputeInclude,
  });
  return toParticipantView(updated);
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const listDisputesForAdmin = async (query: IDisputeListQuery) => {
  const { skip, take, page, limit } = getPagination(query);

  const where: Prisma.DisputeWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.contractId && { contractId: query.contractId }),
  };

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: disputeInclude,
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    disputes: disputes.map(toAdminView),
    meta: buildMeta(total, page, limit),
  };
};

interface RefundOutcome {
  status: RefundStatus | null;
  stripeRefundId: string | null;
  error: string | null;
}

// Never throws: a Stripe failure is recorded and flagged, not allowed to block the resolution.
const attemptStripeRefund = async (
  disputeId: string,
  checkoutSessionId: string | null,
): Promise<RefundOutcome> => {
  try {
    if (!checkoutSessionId)
      throw new Error("The payment has no Stripe session reference");

    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntentId)
      throw new Error("The Stripe checkout session has no payment intent");

    // The idempotency key means retrying the same dispute can never refund twice.
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        metadata: { disputeId },
      },
      { idempotencyKey: `dispute-refund-${disputeId}` },
    );

    return { status: "SUCCEEDED", stripeRefundId: refund.id, error: null };
  } catch (error) {
    console.error(
      `[Dispute] Stripe refund failed for dispute ${disputeId}:`,
      error,
    );
    const message =
      error instanceof Error ? error.message : "Unknown Stripe error";
    return {
      status: "FAILED",
      stripeRefundId: null,
      error: message.slice(0, 500),
    };
  }
};

// Moves the contract (and job) to the state the resolution calls for.
const applyContractOutcome = async (
  tx: Prisma.TransactionClient,
  dispute: DisputeWithDetails,
  resolution: DisputeResolution,
  now: Date,
): Promise<void> => {
  const data: Prisma.ContractUpdateManyMutationInput =
    resolution === "REFUND_CLIENT"
      ? {
          status: "CANCELLED",
          cancelledAt: now,
          cancelReason: "Dispute resolved with a refund to the client",
        }
      : resolution === "RELEASE_TO_FREELANCER"
        ? { status: "COMPLETED", completedAt: now }
        : { status: dispute.previousContractStatus };

  const updated = await tx.contract.updateMany({
    where: { id: dispute.contractId, status: "DISPUTED" },
    data,
  });
  if (updated.count === 0) {
    throw new ApiError(409, "The contract is no longer under dispute");
  }

  if (resolution === "REFUND_CLIENT") {
    // Same as a normal cancellation: the job can be hired for again.
    await tx.job.update({
      where: { id: dispute.contract.job.id },
      data: { status: "OPEN" },
    });
  } else if (resolution === "RELEASE_TO_FREELANCER") {
    await tx.job.update({
      where: { id: dispute.contract.job.id },
      data: { status: "COMPLETED" },
    });
  }
};

const RESOLUTION_MESSAGES: Record<DisputeResolution, string> = {
  REFUND_CLIENT:
    "was resolved with a refund to the client. The contract has been cancelled.",
  RELEASE_TO_FREELANCER:
    "was resolved in favour of the freelancer. The contract is marked completed.",
  NO_ACTION: "was closed with no change. The contract continues.",
};

export const resolveDispute = async (
  disputeId: string,
  admin: JwtPayload,
  input: IResolveDispute,
) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: disputeInclude,
  });
  if (!dispute) throw new ApiError(404, "Dispute not found");
  if (dispute.status !== "OPEN") {
    throw new ApiError(
      409,
      "This dispute has already been resolved or withdrawn",
    );
  }

  const note = input.note.trim();
  let refund: RefundOutcome = {
    status: null,
    stripeRefundId: null,
    error: null,
  };
  let refundedPaymentId: string | null = null;

  if (input.resolution === "REFUND_CLIENT") {
    const payment = await prisma.payment.findFirst({
      where: { contractId: dispute.contractId, status: "SUCCESS" },
      orderBy: { paidAt: { sort: "desc", nulls: "last" } },
      select: { id: true, providerRef: true },
    });

    if (!payment) {
      refund = { status: "NO_PAYMENT", stripeRefundId: null, error: null };
    } else {
      refundedPaymentId = payment.id;
      // Stripe first (idempotent), then one database transaction records everything.
      refund = await attemptStripeRefund(disputeId, payment.providerRef);
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: {
        status: "RESOLVED",
        resolution: input.resolution,
        resolutionNote: note,
        resolvedById: admin.userId,
        resolvedAt: now,
        refundStatus: refund.status,
        stripeRefundId: refund.stripeRefundId,
        refundError: refund.error,
      },
    });
    if (claimed.count === 0) {
      throw new ApiError(
        409,
        "This dispute has already been resolved or withdrawn",
      );
    }

    await applyContractOutcome(tx, dispute, input.resolution, now);

    if (refundedPaymentId) {
      await tx.payment.update({
        where: { id: refundedPaymentId },
        data: { status: "REFUNDED" },
      });
    }

    await logAdminAction(tx, {
      adminId: admin.userId,
      action: "DISPUTE_RESOLVED",
      targetType: "DISPUTE",
      targetId: disputeId,
      note: `${input.resolution}: ${note}`,
    });
  });

  await notifyBothParties(dispute, "DISPUTE_RESOLVED", () => ({
    title: "Dispute resolved",
    message: `The dispute on "${dispute.contract.job.title}" ${RESOLUTION_MESSAGES[input.resolution]}`,
  }));

  const updated = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: disputeInclude,
  });
  return toAdminView(updated);
};
