import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { stripe } from "../../config/stripeClient";
import { env } from "../../config/env";
import { activateContractSystem } from "../contract/contract.service";
import { notifyUser } from "../notification/notification.service";
import redisService from "../../utils/redisService";
import { IPaymentListQuery } from "./payment.interface";
import { Prisma } from "../../../generated/prisma";
import Stripe from "stripe";

const includePaymentDetails = {
  contract: {
    select: { id: true, jobId: true, job: { select: { title: true } } },
  },
};

const omitMetadata = { metadata: true } as const;

export const createCheckoutSession = async (
  contractId: string,
  currentUser: JwtPayload,
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");
  checkOwnership(contract.clientId, currentUser);

  if (contract.status !== "PENDING") {
    throw new ApiError(
      400,
      `Cannot pay for a contract with status ${contract.status}. Expected PENDING.`,
    );
  }

  const existingSuccess = await prisma.payment.findFirst({
    where: { contractId, status: "SUCCESS" },
  });
  if (existingSuccess) {
    throw new ApiError(409, "This contract has already been paid for");
  }

  const amountInCents = Math.round(Number(contract.agreedBudget) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Nexora Contract Payment — Contract ${contract.id}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    metadata: { contractId: contract.id, payerId: currentUser.userId },
    success_url: `${env.FRONTEND_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/payments/cancel`,
  });

  const payment = await prisma.payment.create({
    data: {
      contractId,
      payerId: currentUser.userId,
      amount: contract.agreedBudget,
      currency: "usd",
      provider: "STRIPE",
      status: "PENDING",
      providerRef: session.id,
    },
    omit: omitMetadata,
  });

  return { checkoutUrl: session.url, payment };
};

export const getPaymentsForContract = async (
  contractId: string,
  currentUser: JwtPayload,
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");

  const isParticipant =
    contract.clientId === currentUser.userId ||
    contract.freelancerId === currentUser.userId;
  if (!isParticipant && currentUser.role !== "ADMIN") {
    throw new ApiError(403, "You are not a participant in this contract");
  }

  return prisma.payment.findMany({
    where: { contractId },
    orderBy: { createdAt: "desc" },
    include: includePaymentDetails,
    omit: omitMetadata,
  });
};

export const listMyPayments = async (
  payerId: string,
  query: IPaymentListQuery,
) => {
  const { skip, take, page, limit } = getPagination(query);
  const where: Prisma.PaymentWhereInput = {
    payerId,
    ...(query.status && { status: query.status }),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: includePaymentDetails,
      omit: omitMetadata,
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, meta: buildMeta(total, page, limit) };
};

const finalizeSuccessfulPayment = async (
  paymentId: string,
  session: Stripe.Checkout.Session,
): Promise<void> => {
  const claimed = await prisma.payment.updateMany({
    where: { id: paymentId, status: { in: ["PENDING", "PROCESSING"] } },
    data: {
      status: "SUCCESS",
      metadata: session as unknown as Prisma.InputJsonValue,
    },
  });
  if (claimed.count === 0) return;

  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { contract: { select: { id: true, status: true } } },
  });

  if (payment.contract.status !== "PENDING") {
    // e.g. the contract was cancelled while the client was on the Stripe page.
    console.error(
      `[Payment] Payment ${paymentId} succeeded but contract ${payment.contract.id} is ${payment.contract.status}, not PENDING. A manual refund may be needed.`,
    );
    return;
  }

  const contract = await activateContractSystem(payment.contract.id);

  await notifyUser({
    userId: contract.freelancerId,
    type: "PAYMENT_SUCCESSFUL",
    title: "Payment received",
    message:
      "The client's payment has been confirmed and your contract is now active.",
    link: `/contracts/${contract.id}`,
    entityType: "PAYMENT",
    entityId: paymentId,
    meta: { contractId: contract.id, jobId: contract.jobId },
  });
};

/**
 * Self-heal fallback for the success-page redirect. The webhook stays the
 * authoritative path; this covers a webhook that hasn't landed yet (or
 * `stripe listen` not running locally). Idempotent via finalizeSuccessfulPayment.
 */
export const syncPaymentFromStripeSession = async (
  sessionId: string,
  currentUser: JwtPayload,
) => {
  const payment = await prisma.payment.findUnique({
    where: { providerRef: sessionId },
  });
  if (!payment) throw new ApiError(404, "Payment not found for this session");

  checkOwnership(payment.payerId, currentUser);

  if (payment.status !== "SUCCESS") {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      await finalizeSuccessfulPayment(payment.id, session);
    }
  }

  return prisma.payment.findUniqueOrThrow({
    where: { id: payment.id },
    include: includePaymentDetails,
    omit: omitMetadata,
  });
};

export const handleStripeWebhookEvent = async (event: Stripe.Event) => {
  const eventDedupeKey = `payment:webhook-event:${event.id}`;
  if (await redisService.exists(eventDedupeKey)) {
    console.log(
      `[Stripe Webhook] Duplicate delivery of event ${event.id}, skipping`,
    );
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await prisma.payment.findUnique({
        where: { providerRef: session.id },
      });

      if (!payment) {
        console.error(
          `[Stripe Webhook] No Payment row found for session ${session.id}`,
        );
        return;
      }

      if (session.payment_status === "paid") {
        await finalizeSuccessfulPayment(payment.id, session);
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await prisma.payment.updateMany({
        where: { providerRef: session.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  // Set only after successful processing, so a failure above still lets
  // Stripe's retry through. Duplicates are also safe thanks to the atomic claim.
  await redisService.set(eventDedupeKey, "1", 24 * 60 * 60);
};
