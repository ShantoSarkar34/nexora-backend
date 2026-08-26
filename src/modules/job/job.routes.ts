import { Router } from "express";
import * as jobController from "./job.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
  listJobsQuerySchema,
} from "./job.validation";

const router = Router();

// Public listing
router.get("/", validateRequest(listJobsQuerySchema), jobController.listJobs);

// Freelancer — saved jobs (must come before the generic "/:jobId" route below)
router.get(
  "/saved/me",
  authenticate,
  authorize("FREELANCER"),
  jobController.listSavedJobs
);
router.post(
  "/:jobId/save",
  authenticate,
  authorize("FREELANCER"),
  jobController.saveJob
);
router.delete(
  "/:jobId/save",
  authenticate,
  authorize("FREELANCER"),
  jobController.unsaveJob
);

// Client — private
router.post(
  "/",
  authenticate,
  authorize("CLIENT"),
  validateRequest(createJobSchema),
  jobController.createJob
);
router.get(
  "/client/me",
  authenticate,
  authorize("CLIENT"),
  jobController.listMyJobs
);
router.patch(
  "/:jobId",
  authenticate,
  authorize("CLIENT"),
  validateRequest(updateJobSchema),
  jobController.updateJob
);
router.patch(
  "/:jobId/status",
  authenticate,
  authorize("CLIENT"),
  validateRequest(updateJobStatusSchema),
  jobController.updateJobStatus
);
router.delete(
  "/:jobId",
  authenticate,
  authorize("CLIENT"),
  jobController.deleteJob
);

// Public — job details (must come after the more specific routes above)
router.get("/:jobId", jobController.getJobById);

export default router;
