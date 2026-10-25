import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import * as dashboardService from "./dashboard.service";

export const getFreelancerStats = catchAsync(
  async (req: Request, res: Response) => {
    const stats = await dashboardService.getFreelancerStats(req.user!.userId);
    sendResponse(res, 200, {
      success: true,
      message: "Dashboard stats fetched",
      data: stats,
    });
  },
);

export const getClientStats = catchAsync(
  async (req: Request, res: Response) => {
    const stats = await dashboardService.getClientStats(req.user!.userId);
    sendResponse(res, 200, {
      success: true,
      message: "Dashboard stats fetched",
      data: stats,
    });
  },
);
