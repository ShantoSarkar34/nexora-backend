// src/modules/auth/auth.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import * as authService from "./auth.service";
import prisma from "../../config/prismaClient";
import { authCookieOptions } from "../../config/cookieOptions";
import { CURRENT_USER_SELECT } from "../user/user.constants";

export const register = catchAsync(async (req: Request, res: Response) => {
  const user = await authService.registerUser(req.body);
  sendResponse(res, 201, {
    success: true,
    message: "Registration successful. You can now log in.",
    data: user,
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { token, user } = await authService.loginUser(req.body);
  res.cookie("accessToken", token, authCookieOptions);
  sendResponse(res, 200, {
    success: true,
    message: "Login successful",
    data: user,
  });
});

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const { token, user } = await authService.googleAuth(req.body);
  res.cookie("accessToken", token, authCookieOptions);
  sendResponse(res, 200, {
    success: true,
    message: "Google authentication successful",
    data: user,
  });
});

export const sendVerificationOtp = catchAsync(
  async (req: Request, res: Response) => {
    await authService.sendVerificationOtp(req.user!.userId);
    sendResponse(res, 200, {
      success: true,
      message: "Verification code sent to your email.",
    });
  },
);

export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  await authService.verifyOtp(req.user!.userId, req.body.otp);
  sendResponse(res, 200, {
    success: true,
    message: "Account verified successfully.",
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie("accessToken", { ...authCookieOptions, maxAge: undefined });
  sendResponse(res, 200, { success: true, message: "Logged out successfully" });
});

export const forgotPassword = catchAsync(
  async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    sendResponse(res, 200, {
      success: true,
      message:
        "If an account with that email exists, a reset link has been sent.",
    });
  },
);

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  sendResponse(res, 200, {
    success: true,
    message: "Password reset successful. You can now log in.",
  });
});

export const changePassword = catchAsync(
  async (req: Request, res: Response) => {
    const token = await authService.changePassword(req.user!.userId, req.body);
    res.cookie("accessToken", token, authCookieOptions);
    sendResponse(res, 200, {
      success: true,
      message: "Password changed successfully",
    });
  },
);

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: CURRENT_USER_SELECT,
  });
  sendResponse(res, 200, {
    success: true,
    message: "Current user fetched",
    data: user,
  });
});

export const adminOnlyPing = catchAsync(async (req: Request, res: Response) => {
  sendResponse(res, 200, { success: true, message: "You have admin access." });
});
