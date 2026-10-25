import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as paymentService from "./payment.service";
import { listTransactionsSchema } from "./payment.validation";

export const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const result = await paymentService.createCheckoutSession(
      getParam(req, "contractId"),
      req.user!,
    );
    sendResponse(res, 201, {
      success: true,
      message: "Checkout session created",
      data: result,
    });
  },
);

export const getPaymentsForContract = catchAsync(
  async (req: Request, res: Response) => {
    const payments = await paymentService.getPaymentsForContract(
      getParam(req, "contractId"),
      req.user!,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Payments fetched",
      data: payments,
    });
  },
);

export const listMyPayments = catchAsync(
  async (req: Request, res: Response) => {
    const { payments, meta } = await paymentService.listMyPayments(
      req.user!.userId,
      req.query as any,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Payment history fetched",
      data: payments,
      meta,
    });
  },
);

export const verifyPaymentSession = catchAsync(
  async (req: Request, res: Response) => {
    const payment = await paymentService.syncPaymentFromStripeSession(
      getParam(req, "sessionId"),
      req.user!,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Payment status synced",
      data: payment,
    });
  },
);

export const getFreelancerEarnings = catchAsync(
  async (req: Request, res: Response) => {
    const summary = await paymentService.getFreelancerEarningsSummary(
      req.user!.userId,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Earnings fetched",
      data: summary,
    });
  },
);

export const listFreelancerTransactions = catchAsync(
  async (req: Request, res: Response) => {
    // Parsed here so blank params are ignored and errors come back as a field map.
    const { query } = listTransactionsSchema.parse({ query: req.query });
    const { transactions, meta } =
      await paymentService.listFreelancerTransactions(req.user!.userId, query);
    sendResponse(res, 200, {
      success: true,
      message: "Transactions fetched",
      data: transactions,
      meta,
    });
  },
);

export const getClientSpending = catchAsync(
  async (req: Request, res: Response) => {
    const summary = await paymentService.getClientSpendingSummary(
      req.user!.userId,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Spending fetched",
      data: summary,
    });
  },
);
