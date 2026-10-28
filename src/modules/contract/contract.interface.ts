import { ContractStatus } from "../../../generated/prisma";
import { IAttachment } from "../upload/upload.interface";

export interface ISubmitWork {
  submissionNote?: string;
  submissionUrl?: string;
  attachments?: IAttachment[];
}

export interface ICancelContract {
  reason: string;
}

export interface IContractListQuery {
  status?: ContractStatus;
  page?: string;
  limit?: string;
}
