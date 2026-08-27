import { Router } from "express";
import * as reviewController from "./review.controller";
import { authenticate } from "../../middleware/auth.middleware";
import validateRequest from "../../middleware/validateRequest";
import {
  createReviewSchema,
  listReviewsQuerySchema,
} from "./review.validation";

const router = Router();

router.post(
  "/contract/:contractId",
  authenticate,
  validateRequest(createReviewSchema),
  reviewController.createReview
);
router.get(
  "/contract/:contractId",
  authenticate,
  reviewController.getReviewsForContract
);

// Public — no login needed to view someone's reputation
router.get(
  "/user/:userId",
  validateRequest(listReviewsQuerySchema),
  reviewController.listReviewsForUser
);
router.get("/user/:userId/summary", reviewController.getRatingSummary);

export default router;
