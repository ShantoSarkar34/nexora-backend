import { ContractStatus } from "../../../generated/prisma/client";

export interface ISubmitWork {
  submissionNote?: string;
  submissionUrl?: string;
}

export interface ICancelContract {
  reason: string;
}

export interface IContractListQuery {
  status?: ContractStatus;
  page?: string;
  limit?: string;
}
