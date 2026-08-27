import { Router } from "express";
import * as authController from "./auth.controller";
import validateRequest from "../../middleware/validateRequest";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  otpRateLimiter,
  registerRateLimiter,
} from "../../middleware/rateLimiters";

const router = Router();

router.post(
  "/register",
  registerRateLimiter,
  validateRequest(registerSchema),
  authController.register
);
router.post(
  "/login",
  loginRateLimiter,
  validateRequest(loginSchema),
  authController.login
);
router.post(
  "/send-verification-otp",
  authenticate,
  otpRateLimiter,
  authController.sendVerificationOtp
);

router.post(
  "/verify-otp",
  authenticate,
  validateRequest(verifyOtpSchema),
  authController.verifyOtp
);

router.post("/logout", authenticate, authController.logout);

router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

router.get("/me", authenticate, authController.getMe);
router.get(
  "/admin-only",
  authenticate,
  authorize("ADMIN"),
  authController.adminOnlyPing
);

export default router;
