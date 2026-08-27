import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as applicationService from "./application.service";

export const createApplication = catchAsync(
  async (req: Request, res: Response) => {
    const application = await applicationService.createApplication(
      req.user!.userId,
      req.body
    );
    sendResponse(res, 201, {
      success: true,
      message: "Application submitted",
      data: application,
    });
  }
);

export const getApplicationById = catchAsync(
  async (req: Request, res: Response) => {
    const application = await applicationService.getApplicationById(
      getParam(req, "applicationId"),
      req.user!
    );
    sendResponse(res, 200, {
      success: true,
      message: "Application fetched",
      data: application,
    });
  }
);

export const listMyApplications = catchAsync(
  async (req: Request, res: Response) => {
    const { applications, meta } = await applicationService.listMyApplications(
      req.user!.userId,
      req.query as any
    );
    sendResponse(res, 200, {
      success: true,
      message: "Your applications fetched",
      data: applications,
      meta,
    });
  }
);

export const listApplicationsForJob = catchAsync(
  async (req: Request, res: Response) => {
    const { applications, meta } =
      await applicationService.listApplicationsForJob(
        getParam(req, "jobId"),
        req.user!,
        req.query as any
      );
    sendResponse(res, 200, {
      success: true,
      message: "Applications fetched",
      data: applications,
      meta,
    });
  }
);

export const updateApplicationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const application = await applicationService.updateApplicationStatus(
      getParam(req, "applicationId"),
      req.user!,
      req.body.status
    );
    sendResponse(res, 200, {
      success: true,
      message: `Application ${application.status.toLowerCase()}`,
      data: application,
    });
  }
);

export const withdrawApplication = catchAsync(
  async (req: Request, res: Response) => {
    const application = await applicationService.withdrawApplication(
      getParam(req, "applicationId"),
      req.user!
    );
    sendResponse(res, 200, {
      success: true,
      message: "Application withdrawn",
      data: application,
    });
  }
);
