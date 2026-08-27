import { Router } from "express";
import * as applicationController from "./application.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  listApplicationsQuerySchema,
} from "./application.validation";

const router = Router();

// Freelancer
router.post(
  "/",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(createApplicationSchema),
  applicationController.createApplication
);
router.get(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(listApplicationsQuerySchema),
  applicationController.listMyApplications
);
router.post(
  "/:applicationId/withdraw",
  authenticate,
  authorize("FREELANCER"),
  applicationController.withdrawApplication
);

// Client
router.get(
  "/job/:jobId",
  authenticate,
  authorize("CLIENT"),
  validateRequest(listApplicationsQuerySchema),
  applicationController.listApplicationsForJob
);
router.patch(
  "/:applicationId/status",
  authenticate,
  authorize("CLIENT"),
  validateRequest(updateApplicationStatusSchema),
  applicationController.updateApplicationStatus
);

// Shared — either party (ownership checked inside the service)
router.get(
  "/:applicationId",
  authenticate,
  applicationController.getApplicationById
);

export default router;
