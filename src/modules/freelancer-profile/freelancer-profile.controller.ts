import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as freelancerProfileService from "./freelancer-profile.service";
import { listFreelancersSchema } from "./freelancer-profile.validation";

export const createFreelancerProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await freelancerProfileService.createFreelancerProfile(
      req.user!.userId,
      req.body,
    );
    sendResponse(res, 201, {
      success: true,
      message: "Freelancer profile created",
      data: profile,
    });
  },
);

export const getMyFreelancerProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await freelancerProfileService.getMyFreelancerProfile(
      req.user!.userId,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Profile fetched",
      data: profile,
    });
  },
);

export const updateFreelancerProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await freelancerProfileService.updateFreelancerProfile(
      req.user!.userId,
      req.user!,
      req.body,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Profile updated",
      data: profile,
    });
  },
);

export const addSkill = catchAsync(async (req: Request, res: Response) => {
  const skill = await freelancerProfileService.addSkill(
    req.user!.userId,
    req.body.name,
  );
  sendResponse(res, 201, {
    success: true,
    message: "Skill added",
    data: skill,
  });
});

export const removeSkill = catchAsync(async (req: Request, res: Response) => {
  await freelancerProfileService.removeSkill(
    req.user!.userId,
    getParam(req, "skillId"),
    req.user!,
  );
  sendResponse(res, 200, { success: true, message: "Skill removed" });
});

export const addExperience = catchAsync(async (req: Request, res: Response) => {
  const experience = await freelancerProfileService.addExperience(
    req.user!.userId,
    req.body,
  );
  sendResponse(res, 201, {
    success: true,
    message: "Experience added",
    data: experience,
  });
});

export const deleteExperience = catchAsync(
  async (req: Request, res: Response) => {
    await freelancerProfileService.deleteExperience(
      getParam(req, "experienceId"),
      req.user!,
    );
    sendResponse(res, 200, { success: true, message: "Experience deleted" });
  },
);

export const addPortfolio = catchAsync(async (req: Request, res: Response) => {
  const portfolio = await freelancerProfileService.addPortfolio(
    req.user!.userId,
    req.body,
  );
  sendResponse(res, 201, {
    success: true,
    message: "Portfolio item added",
    data: portfolio,
  });
});

export const deletePortfolio = catchAsync(
  async (req: Request, res: Response) => {
    await freelancerProfileService.deletePortfolio(
      getParam(req, "portfolioId"),
      req.user!,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Portfolio item deleted",
    });
  },
);

export const getPublicFreelancerProfile = catchAsync(
  async (req: Request, res: Response) => {
    const profile = await freelancerProfileService.getPublicFreelancerProfile(
      getParam(req, "userId"),
    );
    sendResponse(res, 200, {
      success: true,
      message: "Profile fetched",
      data: profile,
    });
  },
);

export const listFreelancers = catchAsync(
  async (req: Request, res: Response) => {
    // Parsed here (not via validateRequest) because the service needs the coerced
    // numbers and defaults. A ZodError still goes through the error handler as 400.
    const { query } = listFreelancersSchema.parse({ query: req.query });
    const { items, meta } =
      await freelancerProfileService.listFreelancers(query);
    sendResponse(res, 200, {
      success: true,
      message: "Freelancers fetched",
      data: items,
      meta,
    });
  },
);
