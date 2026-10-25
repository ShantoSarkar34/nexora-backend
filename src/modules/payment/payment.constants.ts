// src/modules/payment/payment.constants.ts  (NEW)
import { ContractStatus } from "../../../generated/prisma";

export const EARNED_CONTRACT_STATUSES: ContractStatus[] = ["COMPLETED"];
export const ESCROW_CONTRACT_STATUSES: ContractStatus[] = [
  "ACTIVE",
  "SUBMITTED",
  "DISPUTED",
];
