import { Router } from "express";
import * as aiMatchController from "./ai-match.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();

router.get(
  "/jobs/:jobId/rule-based",
  authenticate,
  authorize("FREELANCER"),
  aiMatchController.getRuleBasedMatch
);
router.post(
  "/jobs/:jobId/analyze",
  authenticate,
  authorize("FREELANCER"),
  aiMatchController.requestAiAnalysis
);
router.get(
  "/jobs/:jobId/analysis",
  authenticate,
  authorize("FREELANCER"),
  aiMatchController.getSavedAnalysis
);

export default router;
