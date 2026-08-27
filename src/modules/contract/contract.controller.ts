import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as contractService from "./contract.service";

export const hireFreelancer = catchAsync(
  async (req: Request, res: Response) => {
    const contract = await contractService.hireFreelancer(
      getParam(req, "applicationId"),
      req.user!
    );
    sendResponse(res, 201, {
      success: true,
      message: "Freelancer hired. Contract created.",
      data: contract,
    });
  }
);

export const getContractById = catchAsync(
  async (req: Request, res: Response) => {
    const contract = await contractService.getContractById(
      getParam(req, "contractId"),
      req.user!
    );
    sendResponse(res, 200, {
      success: true,
      message: "Contract fetched",
      data: contract,
    });
  }
);

export const listMyContracts = catchAsync(
  async (req: Request, res: Response) => {
    const { contracts, meta } = await contractService.listMyContracts(
      req.user!,
      req.query as any
    );
    sendResponse(res, 200, {
      success: true,
      message: "Contracts fetched",
      data: contracts,
      meta,
    });
  }
);

export const activateContract = catchAsync(
  async (req: Request, res: Response) => {
    const contract = await contractService.activateContract(
      getParam(req, "contractId"),
      req.user!
    );
    sendResponse(res, 200, {
      success: true,
      message: "Contract activated",
      data: contract,
    });
  }
);

export const submitWork = catchAsync(async (req: Request, res: Response) => {
  const contract = await contractService.submitWork(
    getParam(req, "contractId"),
    req.user!,
    req.body
  );
  sendResponse(res, 200, {
    success: true,
    message: "Work submitted",
    data: contract,
  });
});

export const requestRevision = catchAsync(
  async (req: Request, res: Response) => {
    const contract = await contractService.requestRevision(
      getParam(req, "contractId"),
      req.user!
    );
    sendResponse(res, 200, {
      success: true,
      message: "Revision requested",
      data: contract,
    });
  }
);

export const approveWork = catchAsync(async (req: Request, res: Response) => {
  const contract = await contractService.approveWork(
    getParam(req, "contractId"),
    req.user!
  );
  sendResponse(res, 200, {
    success: true,
    message: "Contract completed",
    data: contract,
  });
});

export const cancelContract = catchAsync(
  async (req: Request, res: Response) => {
    const contract = await contractService.cancelContract(
      getParam(req, "contractId"),
      req.user!,
      req.body.reason
    );
    sendResponse(res, 200, {
      success: true,
      message: "Contract cancelled",
      data: contract,
    });
  }
);
