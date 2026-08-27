import { ContractStatus } from "../../../generated/prisma/client";

export const CONTRACT_STATUS_TRANSITIONS: Record<
  ContractStatus,
  ContractStatus[]
> = {
  PENDING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["COMPLETED", "ACTIVE"], 
  COMPLETED: [],
  CANCELLED: [], 
  DISPUTED: [], 
};

export const CANCELLABLE_STATUSES: ContractStatus[] = ["PENDING", "ACTIVE"];
