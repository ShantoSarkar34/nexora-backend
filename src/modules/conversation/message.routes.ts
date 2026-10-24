import { Router } from "express";
import * as conversationController from "./conversation.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";

const router = Router();

router.get(
  "/unread-count",
  authenticate,
  authorize("CLIENT", "FREELANCER"),
  conversationController.getUnreadMessageCount,
);

export default router;
