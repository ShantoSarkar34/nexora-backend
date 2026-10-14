import { rateLimiter } from "./rateLimiter";
import { Request } from "express";

const byUserId = (req: Request): string =>
  req.user?.userId ?? req.ip ?? "unknown";

export const loginRateLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 10,
  keyPrefix: "login",
});

export const registerRateLimiter = rateLimiter({
  windowSeconds: 60 * 60,
  maxRequests: 5,
  keyPrefix: "register",
});

export const forgotPasswordRateLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 5,
  keyPrefix: "forgot-password",
});

export const otpRateLimiter = rateLimiter({
  windowSeconds: 60 * 60,
  maxRequests: 5,
  keyPrefix: "send-otp",
  keyGenerator: byUserId,
});

export const changePasswordRateLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 5,
  keyPrefix: "change-password",
  keyGenerator: byUserId,
});

export const deleteAccountRateLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 5,
  keyPrefix: "delete-account",
  keyGenerator: byUserId,
});
