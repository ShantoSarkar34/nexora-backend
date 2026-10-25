import { Router } from "express";
import * as jobController from "./job.controller";
import * as recommendationController from "../recommendation/recommendation.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { optionalAuthenticate } from "../../middleware/optionalAuth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
  listJobsQuerySchema,
} from "./job.validation";

const router = Router();

// Public listing (optional login adds isSaved/hasApplied for freelancers)
router.get(
  "/",
  optionalAuthenticate,
  validateRequest(listJobsQuerySchema),
  jobController.listJobs,
);

router.get(
  "/saved/me",
  authenticate,
  authorize("FREELANCER"),
  jobController.listSavedJobs,
);
router.get(
  "/recommended",
  authenticate,
  authorize("FREELANCER"),
  recommendationController.getRecommendedJobs,
);
router.post(
  "/:jobId/save",
  authenticate,
  authorize("FREELANCER"),
  jobController.saveJob,
);
router.delete(
  "/:jobId/save",
  authenticate,
  authorize("FREELANCER"),
  jobController.unsaveJob,
);

// Client: private
router.post(
  "/",
  authenticate,
  authorize("CLIENT"),
  validateRequest(createJobSchema),
  jobController.createJob,
);
router.get(
  "/client/me",
  authenticate,
  authorize("CLIENT"),
  jobController.listMyJobs,
);
router.patch(
  "/:jobId",
  authenticate,
  authorize("CLIENT"),
  validateRequest(updateJobSchema),
  jobController.updateJob,
);
router.patch(
  "/:jobId/status",
  authenticate,
  authorize("CLIENT"),
  validateRequest(updateJobStatusSchema),
  jobController.updateJobStatus,
);
router.delete(
  "/:jobId",
  authenticate,
  authorize("CLIENT"),
  jobController.deleteJob,
);

// Public: job details (must come after the more specific routes above)
router.get("/:jobId", optionalAuthenticate, jobController.getJobById);

export default router;
