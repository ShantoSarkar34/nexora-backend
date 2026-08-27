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
  paymentController.createCheckoutSession
);
router.get(
  "/contract/:contractId",
  authenticate,
  paymentController.getPaymentsForContract
);
router.get(
  "/me",
  authenticate,
  validateRequest(listPaymentsQuerySchema),
  paymentController.listMyPayments
);

export default router;
