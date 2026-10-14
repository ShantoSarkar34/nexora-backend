// src/modules/user/user.routes.ts
import { Router } from "express";
import * as userController from "./user.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { uploadSingleImage } from "../../middleware/upload.middleware";
import validateRequest from "../../middleware/validateRequest";
import { deleteAccountRateLimiter } from "../../middleware/rateLimiters";
import { updateMeSchema, deleteAccountSchema } from "./user.validation";

const router = Router();

router.post(
  "/avatar",
  authenticate,
  uploadSingleImage,
  userController.uploadAvatar,
);
router.patch(
  "/me",
  authenticate,
  validateRequest(updateMeSchema),
  userController.updateMe,
);
router.delete(
  "/me",
  authenticate,
  deleteAccountRateLimiter,
  validateRequest(deleteAccountSchema),
  userController.deleteMe,
);

export default router;
