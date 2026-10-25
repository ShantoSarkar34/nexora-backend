import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import * as recommendationService from "./recommendation.service";
import { recommendedJobsSchema } from "./recommendation.validation";

export const getRecommendedJobs = catchAsync(
  async (req: Request, res: Response) => {
    // Parsed here so the service gets a real number and a blank ?limit= falls back to the default.
    const { query } = recommendedJobsSchema.parse({ query: req.query });
    const result = await recommendationService.getRecommendedJobs(
      req.user!.userId,
      query,
    );

    sendResponse(res, 200, {
      success: true,
      message: result.message,
      data: result.items,
      meta: {
        limit: query.limit,
        ...(result.reason && { reason: result.reason }),
      },
    });
  },
);
