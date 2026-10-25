import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as adminService from "./admin.service";
import * as disputeService from "../dispute/dispute.service";
import { adminListUsersSchema, adminListJobsSchema } from "./admin.validation";
import { listDisputesSchema } from "../dispute/dispute.validation";

export const getStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await adminService.getAdminStats();
  sendResponse(res, 200, {
    success: true,
    message: "Admin stats fetched",
    data: stats,
  });
});

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { query } = adminListUsersSchema.parse({ query: req.query });
  const { users, meta } = await adminService.listUsers(query);
  sendResponse(res, 200, {
    success: true,
    message: "Users fetched",
    data: users,
    meta,
  });
});

export const setUserSuspension = catchAsync(
  async (req: Request, res: Response) => {
    const user = await adminService.setUserSuspension(
      req.user!,
      getParam(req, "userId"),
      req.body,
    );
    sendResponse(res, 200, {
      success: true,
      message: user.isSuspended ? "User suspended" : "User unsuspended",
      data: user,
    });
  },
);

export const listJobs = catchAsync(async (req: Request, res: Response) => {
  const { query } = adminListJobsSchema.parse({ query: req.query });
  const { jobs, meta } = await adminService.listJobs(query);
  sendResponse(res, 200, {
    success: true,
    message: "Jobs fetched",
    data: jobs,
    meta,
  });
});

export const forceCloseJob = catchAsync(async (req: Request, res: Response) => {
  const job = await adminService.forceCloseJob(
    req.user!,
    getParam(req, "jobId"),
    req.body,
  );
  sendResponse(res, 200, { success: true, message: "Job closed", data: job });
});

export const listDisputes = catchAsync(async (req: Request, res: Response) => {
  const { query } = listDisputesSchema.parse({ query: req.query });
  const { disputes, meta } = await disputeService.listDisputesForAdmin(query);
  sendResponse(res, 200, {
    success: true,
    message: "Disputes fetched",
    data: disputes,
    meta,
  });
});

export const resolveDispute = catchAsync(
  async (req: Request, res: Response) => {
    const dispute = await disputeService.resolveDispute(
      getParam(req, "disputeId"),
      req.user!,
      req.body,
    );
    const refundFailed = dispute.refundStatus === "FAILED";

    sendResponse(res, 200, {
      success: true,
      message: refundFailed
        ? "Dispute resolved, but the Stripe refund failed and needs manual follow-up"
        : "Dispute resolved",
      data: dispute,
    });
  },
);
