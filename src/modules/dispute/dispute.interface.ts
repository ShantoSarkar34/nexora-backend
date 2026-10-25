import { DisputeResolution, DisputeStatus } from "../../../generated/prisma";

export interface IDisputeListQuery {
  status?: DisputeStatus;
  contractId?: string;
  page?: string;
  limit?: string;
}

export interface IResolveDispute {
  resolution: DisputeResolution;
  note: string;
}
