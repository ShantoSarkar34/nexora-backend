import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import ApiError from "../../utils/ApiError";
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
