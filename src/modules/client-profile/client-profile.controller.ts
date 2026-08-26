import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import * as clientProfileService from "./client-profile.service";

export const createClientProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await clientProfileService.createClientProfile(
      req.user!.userId,
      req.body
    );
    sendResponse(res, 201, {
      success: true,
      message: "Client profile created",
      data: profile,
    });
  }
);

export const getMyClientProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await clientProfileService.getMyClientProfile(
      req.user!.userId
    );
    sendResponse(res, 200, {
      success: true,
      message: "Profile fetched",
      data: profile,
    });
  }
);

export const updateClientProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await clientProfileService.updateClientProfile(
      req.user!.userId,
      req.user!,
      req.body
    );
    sendResponse(res, 200, {
      success: true,
      message: "Profile updated",
      data: profile,
    });
  }
);

export const getPublicClientProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await clientProfileService.getPublicClientProfile(
      req.params.userId as string
    );
    sendResponse(res, 200, {
      success: true,
      message: "Profile fetched",
      data: profile,
    });
  }
);
