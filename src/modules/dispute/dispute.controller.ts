import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as disputeService from "./dispute.service";
import { listDisputesSchema } from "./dispute.validation";

export const openDispute = catchAsync(async (req: Request, res: Response) => {
  const dispute = await disputeService.openDispute(
    getParam(req, "contractId"),
    req.user!,
    req.body.reason,
  );
  sendResponse(res, 201, {
    success: true,
    message: "Dispute opened",
    data: dispute,
  });
});

export const listMyDisputes = catchAsync(
  async (req: Request, res: Response) => {
    // Parsed here so the service gets typed values (and blank params are ignored).
    const { query } = listDisputesSchema.parse({ query: req.query });
    const { disputes, meta } = await disputeService.listMyDisputes(
      req.user!,
      query,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Disputes fetched",
      data: disputes,
      meta,
    });
  },
);

export const getDispute = catchAsync(async (req: Request, res: Response) => {
  const dispute = await disputeService.getDisputeById(
    getParam(req, "disputeId"),
    req.user!,
  );
  sendResponse(res, 200, {
    success: true,
    message: "Dispute fetched",
    data: dispute,
  });
});

export const withdrawDispute = catchAsync(
  async (req: Request, res: Response) => {
    const dispute = await disputeService.withdrawDispute(
      getParam(req, "disputeId"),
      req.user!,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Dispute withdrawn",
      data: dispute,
    });
  },
);
