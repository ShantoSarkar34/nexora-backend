// src/modules/user/user.controller.ts  (REPLACE the whole file)
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import ApiError from "../../utils/ApiError";
import { authCookieOptions } from "../../config/cookieOptions";
import * as userService from "./user.service";

export const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No image file provided");
  }

  const user = await userService.uploadUserAvatar(
    req.user!.userId,
    req.file.buffer,
  );
  sendResponse(res, 200, {
    success: true,
    message: "Profile image updated",
    data: user,
  });
});

export const updateMe = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateMyProfile(
    req.user!.userId,
    req.body.name,
  );
  sendResponse(res, 200, {
    success: true,
    message: "Profile updated",
    data: user,
  });
});

export const deleteMe = catchAsync(async (req: Request, res: Response) => {
  await userService.deleteMyAccount(req.user!.userId, req.body);
  res.clearCookie("accessToken", { ...authCookieOptions, maxAge: undefined });
  sendResponse(res, 200, {
    success: true,
    message: "Your account has been deleted",
  });
});
