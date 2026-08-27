import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { stripe } from "../../config/stripeClient";
import { env } from "../../config/env";
import { activateContractSystem } from "../contract/contract.service";
import redisService from "../../utils/redisService";
import { IPaymentListQuery } from "./payment.interface";
import { Prisma } from "../../../generated/prisma/client";
import Stripe from "stripe";
import { notifyUser } from "../notification/notification.service";

const includePaymentDetails = {
  contract: {
    select: { id: true, jobId: true, job: { select: { title: true } } },
  },
};

export const createCheckoutSession = async (
  contractId: string,
  currentUser: JwtPayload
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");
  checkOwnership(contract.clientId, currentUser);

  if (contract.status !== "PENDING") {
    throw new ApiError(
      400,
      `Cannot pay for a contract with status ${contract.status}. Expected PENDING.`
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
  });

  return { checkoutUrl: session.url, payment };
};

export const getPaymentsForContract = async (
  contractId: string,
  currentUser: JwtPayload
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
  });
};

export const listMyPayments = async (
  payerId: string,
  query: IPaymentListQuery
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
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, meta: buildMeta(total, page, limit) };
};

export const handleStripeWebhookEvent = async (event: Stripe.Event) => {
  const eventDedupeKey = `payment:webhook-event:${event.id}`;
  if (await redisService.exists(eventDedupeKey)) {
    console.log(
      `[Stripe Webhook] Duplicate delivery of event ${event.id}, skipping`
    );
    return;
  }
  await redisService.set(eventDedupeKey, "1", 24 * 60 * 60);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await prisma.payment.findUnique({
        where: { providerRef: session.id },
      });

      if (!payment) {
        console.error(
          `[Stripe Webhook] No Payment row found for session ${session.id}`
        );
        return;
      }
      if (payment.status === "SUCCESS") {
        console.log(
          `[Stripe Webhook] Payment ${payment.id} already SUCCESS, skipping`
        );
        return;
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          metadata: session as unknown as Prisma.InputJsonValue,
        },
      });

      const contract = await activateContractSystem(payment.contractId);

      await notifyUser({
        userId: contract.freelancerId,
        type: "PAYMENT_SUCCESSFUL",
        title: "Payment received",
        message:
          "The client's payment has been confirmed and your contract is now active.",
        link: `/contracts/${contract.id}`,
      });

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
};
