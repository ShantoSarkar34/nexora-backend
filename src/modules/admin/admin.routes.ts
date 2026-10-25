import { Router } from "express";
import * as adminController from "./admin.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import { suspendUserSchema, forceCloseJobSchema } from "./admin.validation";
import { resolveDisputeSchema } from "../dispute/dispute.validation";

const router = Router();

// Everything under /admin is ADMIN-only.
router.use(authenticate, authorize("ADMIN"));

router.get("/stats", adminController.getStats);

router.get("/users", adminController.listUsers);
router.patch(
  "/users/:userId/suspension",
  validateRequest(suspendUserSchema),
  adminController.setUserSuspension,
);

router.get("/jobs", adminController.listJobs);
router.patch(
  "/jobs/:jobId/status",
  validateRequest(forceCloseJobSchema),
  adminController.forceCloseJob,
);

router.get("/disputes", adminController.listDisputes);
router.patch(
  "/disputes/:disputeId/resolve",
  validateRequest(resolveDisputeSchema),
  adminController.resolveDispute,
);

export default router;
