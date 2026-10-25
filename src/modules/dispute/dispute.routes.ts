import { Router } from "express";
import * as disputeController from "./dispute.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();

router.get(
  "/me",
  authenticate,
  authorize("CLIENT", "FREELANCER"),
  disputeController.listMyDisputes,
);
router.get(
  "/:disputeId",
  authenticate,
  authorize("CLIENT", "FREELANCER", "ADMIN"),
  disputeController.getDispute,
);
router.patch(
  "/:disputeId/withdraw",
  authenticate,
  authorize("CLIENT", "FREELANCER"),
  disputeController.withdrawDispute,
);

export default router;
