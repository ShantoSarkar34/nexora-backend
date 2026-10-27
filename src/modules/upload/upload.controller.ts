import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import * as uploadService from "./upload.service";

export const signUpload = catchAsync(async (req: Request, res: Response) => {
  const signed = await uploadService.signUpload(req.user!, req.body);
  sendResponse(res, 200, {
    success: true,
    message: "Upload signed",
    data: signed,
  });
});
