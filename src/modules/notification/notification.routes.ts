import { Router } from "express";
import * as notificationController from "./notification.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.get("/me", authenticate, notificationController.getMyNotifications);
router.get(
  "/unread-count",
  authenticate,
  notificationController.getUnreadCount
);
router.patch(
  "/:notificationId/read",
  authenticate,
  notificationController.markAsRead
);
router.patch("/read-all", authenticate, notificationController.markAllAsRead);

export default router;
