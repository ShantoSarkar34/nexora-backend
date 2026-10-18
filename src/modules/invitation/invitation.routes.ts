import { Router } from "express";
import * as invitationController from "./invitation.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import { inviteRateLimiter } from "../../middleware/rateLimiters";
import {
  createInvitationSchema,
  respondInvitationSchema,
} from "./invitation.validation";

const router = Router();

// Client
router.post(
  "/",
  authenticate,
  authorize("CLIENT"),
  validateRequest(createInvitationSchema),
  inviteRateLimiter,
  invitationController.createInvitation,
);
router.get(
  "/sent",
  authenticate,
  authorize("CLIENT"),
  invitationController.listSentInvitations,
);
router.patch(
  "/:invitationId/cancel",
  authenticate,
  authorize("CLIENT"),
  invitationController.cancelInvitation,
);

// Freelancer
router.get(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  invitationController.listMyInvitations,
);
router.patch(
  "/:invitationId/respond",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(respondInvitationSchema),
  invitationController.respondToInvitation,
);

export default router;
