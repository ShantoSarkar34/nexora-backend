// src/modules/payment/payment.webhook.routes.ts
import { Router } from "express";
import { stripeWebhook } from "./payment.webhook.controller";

const router = Router();
router.post("/stripe", stripeWebhook);

export default router;
