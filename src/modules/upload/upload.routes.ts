import { Router } from "express";
import * as uploadController from "./upload.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import { uploadSignRateLimiter } from "../../middleware/rateLimiters";
import { signUploadSchema } from "./upload.validation";

const router = Router();

router.post(
  "/sign",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(signUploadSchema),
  uploadSignRateLimiter,
  uploadController.signUpload,
);

export default router;
