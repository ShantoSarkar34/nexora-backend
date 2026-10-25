import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();

router.get(
  "/freelancer/stats",
  authenticate,
  authorize("FREELANCER"),
  dashboardController.getFreelancerStats,
);
router.get(
  "/client/stats",
  authenticate,
  authorize("CLIENT"),
  dashboardController.getClientStats,
);

export default router;
