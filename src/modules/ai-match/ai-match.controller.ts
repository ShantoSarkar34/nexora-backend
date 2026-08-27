import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as aiMatchService from "./ai-match.service";

export const getRuleBasedMatch = catchAsync(
  async (req: Request, res: Response) => {
    const result = await aiMatchService.getRuleBasedMatch(
      getParam(req, "jobId"),
      req.user!.userId
    );
    sendResponse(res, 200, {
      success: true,
      message: "Rule-based match calculated",
      data: result,
    });
  }
);

export const requestAiAnalysis = catchAsync(
  async (req: Request, res: Response) => {
    const analysis = await aiMatchService.requestAiAnalysis(
      getParam(req, "jobId"),
      req.user!.userId
    );
    sendResponse(res, 200, {
      success: true,
      message: "AI analysis complete",
      data: analysis,
    });
  }
);

export const getSavedAnalysis = catchAsync(
  async (req: Request, res: Response) => {
    const analysis = await aiMatchService.getSavedAnalysis(
      getParam(req, "jobId"),
      req.user!.userId
    );
    sendResponse(res, 200, {
      success: true,
      message: "Saved analysis fetched",
      data: analysis,
    });
  }
);
