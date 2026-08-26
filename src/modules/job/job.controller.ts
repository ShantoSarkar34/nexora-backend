import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as jobService from "./job.service";

export const createJob = catchAsync(async (req: Request, res: Response) => {
  const job = await jobService.createJob(req.user!.userId, req.body);
  sendResponse(res, 201, {
    success: true,
    message: "Job created as draft",
    data: job,
  });
});

export const updateJob = catchAsync(async (req: Request, res: Response) => {
  const job = await jobService.updateJob(
    getParam(req, "jobId"),
    req.user!,
    req.body
  );
  sendResponse(res, 200, { success: true, message: "Job updated", data: job });
});

export const updateJobStatus = catchAsync(
  async (req: Request, res: Response) => {
    const job = await jobService.updateJobStatus(
      getParam(req, "jobId"),
      req.user!,
      req.body.status
    );
    sendResponse(res, 200, {
      success: true,
      message: "Job status updated",
      data: job,
    });
  }
);

export const deleteJob = catchAsync(async (req: Request, res: Response) => {
  await jobService.deleteJob(getParam(req, "jobId"), req.user!);
  sendResponse(res, 200, { success: true, message: "Job deleted" });
});

export const getJobById = catchAsync(async (req: Request, res: Response) => {
  const job = await jobService.getJobById(getParam(req, "jobId"));
  sendResponse(res, 200, { success: true, message: "Job fetched", data: job });
});

export const listJobs = catchAsync(async (req: Request, res: Response) => {
  const { jobs, meta } = await jobService.listJobs(req.query as any);
  sendResponse(res, 200, {
    success: true,
    message: "Jobs fetched",
    data: jobs,
    meta,
  });
});

export const listMyJobs = catchAsync(async (req: Request, res: Response) => {
  const { jobs, meta } = await jobService.listMyJobs(
    req.user!.userId,
    req.query as any
  );
  sendResponse(res, 200, {
    success: true,
    message: "Your jobs fetched",
    data: jobs,
    meta,
  });
});

export const saveJob = catchAsync(async (req: Request, res: Response) => {
  const saved = await jobService.saveJob(
    req.user!.userId,
    getParam(req, "jobId")
  );
  sendResponse(res, 201, { success: true, message: "Job saved", data: saved });
});

export const unsaveJob = catchAsync(async (req: Request, res: Response) => {
  await jobService.unsaveJob(req.user!.userId, getParam(req, "jobId"));
  sendResponse(res, 200, {
    success: true,
    message: "Job removed from saved list",
  });
});

export const listSavedJobs = catchAsync(async (req: Request, res: Response) => {
  const { savedJobs, meta } = await jobService.listSavedJobs(
    req.user!.userId,
    req.query as any
  );
  sendResponse(res, 200, {
    success: true,
    message: "Saved jobs fetched",
    data: savedJobs,
    meta,
  });
});
