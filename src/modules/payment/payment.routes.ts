import { Router } from "express";
import * as paymentController from "./payment.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import { listPaymentsQuerySchema } from "./payment.validation";

const router = Router();

router.post(
  "/contract/:contractId/checkout",
  authenticate,
  authorize("CLIENT"),
  paymentController.createCheckoutSession,
);
router.get(
  "/contract/:contractId",
  authenticate,
  paymentController.getPaymentsForContract,
);
router.get(
  "/me",
  authenticate,
  validateRequest(listPaymentsQuerySchema),
  paymentController.listMyPayments,
);
router.get(
  "/verify/:sessionId",
  authenticate,
  paymentController.verifyPaymentSession,
);

// Recorded balances (no real payouts)
router.get(
  "/earnings/me",
  authenticate,
  authorize("FREELANCER"),
  paymentController.getFreelancerEarnings,
);
router.get(
  "/earnings/me/transactions",
  authenticate,
  authorize("FREELANCER"),
  paymentController.listFreelancerTransactions,
);
router.get(
  "/spending/me",
  authenticate,
  authorize("CLIENT"),
  paymentController.getClientSpending,
);

export default router;
