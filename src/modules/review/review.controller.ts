import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as reviewService from "./review.service";

export const createReview = catchAsync(async (req: Request, res: Response) => {
  const review = await reviewService.createReview(
    getParam(req, "contractId"),
    req.user!,
    req.body
  );
  sendResponse(res, 201, {
    success: true,
    message: "Review submitted",
    data: review,
  });
});

export const getReviewsForContract = catchAsync(
  async (req: Request, res: Response) => {
    const reviews = await reviewService.getReviewsForContract(
      getParam(req, "contractId"),
      req.user!
    );
    sendResponse(res, 200, {
      success: true,
      message: "Reviews fetched",
      data: reviews,
    });
  }
);

export const listReviewsForUser = catchAsync(
  async (req: Request, res: Response) => {
    const { reviews, meta } = await reviewService.listReviewsForUser(
      getParam(req, "userId"),
      req.query as any
    );
    sendResponse(res, 200, {
      success: true,
      message: "Reviews fetched",
      data: reviews,
      meta,
    });
  }
);

export const getRatingSummary = catchAsync(
  async (req: Request, res: Response) => {
    const summary = await reviewService.getRatingSummary(
      getParam(req, "userId")
    );
    sendResponse(res, 200, {
      success: true,
      message: "Rating summary fetched",
      data: summary,
    });
  }
);
