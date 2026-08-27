import { Request, Response } from "express";
import { stripe } from "../../config/stripeClient";
import { env } from "../../config/env";
import ApiError from "../../utils/ApiError";
import catchAsync from "../../utils/catchAsync";
import * as paymentService from "./payment.service";

export const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) throw new ApiError(400, "Missing Stripe signature header");

  let event;
  try {
    // req.body must be the RAW buffer here, not JSON-parsed — that's why
    // this route is mounted with express.raw() before the global json()
    // middleware in app.ts. Signature verification fails otherwise.
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    throw new ApiError(400, "Invalid webhook signature");
  }

  await paymentService.handleStripeWebhookEvent(event);

  res.status(200).json({ received: true });
});
