import { JobStatus, Role } from "../../../generated/prisma";

export interface IAdminUserListQuery {
  role?: Role;
  search?: string;
  isVerified?: boolean;
  page?: string;
  limit?: string;
}

export interface IAdminJobListQuery {
  status?: JobStatus;
  search?: string;
  page?: string;
  limit?: string;
}

export interface ISuspendUser {
  suspended: boolean;
  reason?: string;
}

export interface IForceCloseJob {
  status: "CLOSED" | "CANCELLED";
  note?: string;
}
