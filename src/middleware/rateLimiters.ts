import { Request } from "express";
import { rateLimiter } from "./rateLimiter";

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

// 20 invitations per client per day.
export const inviteRateLimiter = rateLimiter({
  windowSeconds: 24 * 60 * 60,
  maxRequests: 20,
  keyPrefix: "invite",
  keyGenerator: byUserId,
});

// 30 messages per user per minute.
export const messageRateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: "message",
  keyGenerator: byUserId,
});

export const uploadSignRateLimiter = rateLimiter({
  windowSeconds: 60 * 60,
  maxRequests: 30,
  keyPrefix: "upload-sign",
  keyGenerator: byUserId,
});
