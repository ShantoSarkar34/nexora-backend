import { Router } from "express";
import * as contractController from "./contract.controller";
import * as disputeController from "../dispute/dispute.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import {
  submitWorkSchema,
  cancelContractSchema,
  listContractsQuerySchema,
} from "./contract.validation";
import { openDisputeSchema } from "../dispute/dispute.validation";

const router = Router();

router.post(
  "/hire/:applicationId",
  authenticate,
  authorize("CLIENT"),
  contractController.hireFreelancer,
);

router.get(
  "/me",
  authenticate,
  validateRequest(listContractsQuerySchema),
  contractController.listMyContracts,
);
router.get("/:contractId", authenticate, contractController.getContractById);

router.patch(
  "/:contractId/activate",
  authenticate,
  authorize("CLIENT"),
  contractController.activateContract,
);
router.patch(
  "/:contractId/submit",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(submitWorkSchema),
  contractController.submitWork,
);
router.patch(
  "/:contractId/request-revision",
  authenticate,
  authorize("CLIENT"),
  contractController.requestRevision,
);
router.patch(
  "/:contractId/approve",
  authenticate,
  authorize("CLIENT"),
  contractController.approveWork,
);
router.patch(
  "/:contractId/cancel",
  authenticate,
  validateRequest(cancelContractSchema),
  contractController.cancelContract,
);
router.post(
  "/:contractId/dispute",
  authenticate,
  authorize("CLIENT", "FREELANCER"),
  validateRequest(openDisputeSchema),
  disputeController.openDispute,
);

export default router;
