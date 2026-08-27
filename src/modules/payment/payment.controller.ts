import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as paymentService from "./payment.service";

export const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const result = await paymentService.createCheckoutSession(
      getParam(req, "contractId"),
      req.user!
    );
    sendResponse(res, 201, {
      success: true,
      message: "Checkout session created",
      data: result,
    });
  }
);

export const getPaymentsForContract = catchAsync(
  async (req: Request, res: Response) => {
    const payments = await paymentService.getPaymentsForContract(
      getParam(req, "contractId"),
      req.user!
    );
    sendResponse(res, 200, {
      success: true,
      message: "Payments fetched",
      data: payments,
    });
  }
);

export const listMyPayments = catchAsync(
  async (req: Request, res: Response) => {
    const { payments, meta } = await paymentService.listMyPayments(
      req.user!.userId,
      req.query as any
    );
    sendResponse(res, 200, {
      success: true,
      message: "Payment history fetched",
      data: payments,
      meta,
    });
  }
);
