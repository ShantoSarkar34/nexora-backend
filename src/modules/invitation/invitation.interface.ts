import { InvitationStatus } from "../../../generated/prisma";

export interface ICreateInvitation {
  jobId: string;
  freelancerId: string;
  message?: string;
}

export interface IInvitationListQuery {
  status?: InvitationStatus;
  jobId?: string;
  page?: string;
  limit?: string;
}
