import { Router } from "express";
import * as conversationController from "./conversation.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import { messageRateLimiter } from "../../middleware/rateLimiters";
import {
  createConversationSchema,
  sendMessageSchema,
} from "./conversation.validation";

const router = Router();


const participantsOnly = [authenticate, authorize("CLIENT", "FREELANCER")];

router.post(
  "/",
  ...participantsOnly,
  validateRequest(createConversationSchema),
  conversationController.getOrCreateConversation,
);
router.get(
  "/me",
  ...participantsOnly,
  conversationController.listMyConversations,
);
router.get(
  "/:conversationId/messages",
  ...participantsOnly,
  conversationController.listMessages,
);
router.post(
  "/:conversationId/messages",
  ...participantsOnly,
  validateRequest(sendMessageSchema),
  messageRateLimiter,
  conversationController.sendMessage,
);
router.patch(
  "/:conversationId/read",
  ...participantsOnly,
  conversationController.markConversationRead,
);

export default router;
