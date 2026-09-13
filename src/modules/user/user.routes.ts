import { Router } from "express";
import * as userController from "./user.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { uploadSingleImage } from "../../middleware/upload.middleware";

const router = Router();

router.post(
  "/avatar",
  authenticate,
  uploadSingleImage,
  userController.uploadAvatar,
);

export default router;
