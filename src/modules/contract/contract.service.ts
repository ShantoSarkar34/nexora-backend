import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import {
  CONTRACT_STATUS_TRANSITIONS,
  CANCELLABLE_STATUSES,
} from "./contract.constants";
import { ISubmitWork, IContractListQuery } from "./contract.interface";
import { APPLICATION_STATUS_TRANSITIONS } from "../application/application.constants";
import { Prisma } from "../../../generated/prisma/client";

const includeContractDetails = {
  job: { select: { id: true, title: true, status: true } },
  client: { select: { id: true, name: true } },
  freelancer: { select: { id: true, name: true } },
};

export const hireFreelancer = async (
  applicationId: string,
  currentUser: JwtPayload
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });
  if (!application) throw new ApiError(404, "Application not found");

  checkOwnership(application.job.clientId, currentUser);

  if (application.job.status !== "OPEN") {
    throw new ApiError(
      400,
      `Cannot hire — job status is ${application.job.status}, expected OPEN`
    );
  }

  const allowedNext = APPLICATION_STATUS_TRANSITIONS[application.status];
  if (!allowedNext.includes("HIRED")) {
    throw new ApiError(
      400,
      `Cannot hire from application status ${application.status}`
    );
  }

  const existingContract = await prisma.contract.findUnique({
    where: { jobId: application.jobId },
  });
  if (existingContract) {
    throw new ApiError(409, "This job already has an active contract");
  }

  // Everything below runs as ONE atomic operation. All queries use `tx`,
  // never the top-level `prisma` client — mixing the two would silently
  // escape the transaction and defeat the whole point of using one.
  return prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: { status: "HIRED" },
    });

    // Auto-reject every other still-open application for this job —
    // standard marketplace behavior once a hire is made.
    await tx.application.updateMany({
      where: {
        jobId: application.jobId,
        id: { not: applicationId },
        status: { in: ["PENDING", "SHORTLISTED"] },
      },
      data: { status: "REJECTED" },
    });

    await tx.job.update({
      where: { id: application.jobId },
      data: { status: "IN_PROGRESS" },
    });

    return tx.contract.create({
      data: {
        jobId: application.jobId,
        applicationId: application.id,
        clientId: application.job.clientId,
        freelancerId: application.freelancerId,
        agreedBudget: application.proposedBudget,
        status: "PENDING",
      },
      include: includeContractDetails,
    });
  });
};

const assertParticipant = (
  contract: { clientId: string; freelancerId: string },
  currentUser: JwtPayload
) => {
  const isParticipant =
    contract.clientId === currentUser.userId ||
    contract.freelancerId === currentUser.userId;
  if (!isParticipant && currentUser.role !== "ADMIN") {
    throw new ApiError(403, "You are not a participant in this contract");
  }
};

export const getContractById = async (
  contractId: string,
  currentUser: JwtPayload
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: includeContractDetails,
  });
  if (!contract) throw new ApiError(404, "Contract not found");
  assertParticipant(contract, currentUser);
  return contract;
};

export const listMyContracts = async (
  currentUser: JwtPayload,
  query: IContractListQuery
) => {
  const { skip, take, page, limit } = getPagination(query);
  const roleField = currentUser.role === "CLIENT" ? "clientId" : "freelancerId";

  const where: Prisma.ContractWhereInput = {
    [roleField]: currentUser.userId,
    ...(query.status && { status: query.status }),
  };

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: includeContractDetails,
    }),
    prisma.contract.count({ where }),
  ]);

  return { contracts, meta: buildMeta(total, page, limit) };
};

const transitionContract = async (
  contractId: string,
  currentUser: JwtPayload,
  targetStatus: "ACTIVE" | "SUBMITTED" | "COMPLETED",
  ownerField: "clientId" | "freelancerId",
  extraData: Prisma.ContractUpdateInput = {}
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");
  checkOwnership(contract[ownerField], currentUser);

  const allowedNext = CONTRACT_STATUS_TRANSITIONS[contract.status];
  if (!allowedNext.includes(targetStatus)) {
    throw new ApiError(
      400,
      `Cannot change contract status from ${contract.status} to ${targetStatus}`
    );
  }

  return prisma.contract.update({
    where: { id: contractId },
    data: { status: targetStatus, ...extraData },
    include: includeContractDetails,
  });
};

// Client-triggered for now. Phase 11 will call this same transition logic
// from a verified payment webhook instead of exposing it as a direct route.
export const activateContract = (contractId: string, currentUser: JwtPayload) =>
  transitionContract(contractId, currentUser, "ACTIVE", "clientId");

export const submitWork = (
  contractId: string,
  currentUser: JwtPayload,
  data: ISubmitWork
) =>
  transitionContract(contractId, currentUser, "SUBMITTED", "freelancerId", {
    submissionNote: data.submissionNote,
    submissionUrl: data.submissionUrl,
    submittedAt: new Date(),
  });

export const requestRevision = (contractId: string, currentUser: JwtPayload) =>
  transitionContract(contractId, currentUser, "ACTIVE", "clientId", {
    submissionNote: null,
    submissionUrl: null,
    submittedAt: null,
  });

/** Client approves submitted work — completes both the Contract and the Job atomically. */
export const approveWork = async (
  contractId: string,
  currentUser: JwtPayload
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");
  checkOwnership(contract.clientId, currentUser);

  const allowedNext = CONTRACT_STATUS_TRANSITIONS[contract.status];
  if (!allowedNext.includes("COMPLETED")) {
    throw new ApiError(
      400,
      `Cannot complete a contract with status ${contract.status}`
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: includeContractDetails,
    });
    await tx.job.update({
      where: { id: contract.jobId },
      data: { status: "COMPLETED" },
    });
    return updated;
  });
};

/** Either participant can cancel, while it's still PENDING or ACTIVE. Reopens the job for re-hiring. */
export const cancelContract = async (
  contractId: string,
  currentUser: JwtPayload,
  reason: string
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");
  assertParticipant(contract, currentUser);

  if (!CANCELLABLE_STATUSES.includes(contract.status)) {
    throw new ApiError(
      400,
      `Cannot cancel a contract with status ${contract.status}`
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({
      where: { id: contractId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
      },
      include: includeContractDetails,
    });
    await tx.job.update({
      where: { id: contract.jobId },
      data: { status: "OPEN" },
    });
    return updated;
  });
};

export const activateContractSystem = async (contractId: string) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");

  const allowedNext = CONTRACT_STATUS_TRANSITIONS[contract.status];
  if (!allowedNext.includes("ACTIVE")) {
    throw new ApiError(
      400,
      `Cannot activate contract from status ${contract.status}`
    );
  }

  return prisma.contract.update({
    where: { id: contractId },
    data: { status: "ACTIVE" },
  });
};
