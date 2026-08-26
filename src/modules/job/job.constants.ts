import { JobStatus } from "../../../generated/prisma/client";

export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  IN_PROGRESS: [],
  COMPLETED: [],
  CANCELLED: [],
  CLOSED: [],
};

export const EDITABLE_JOB_STATUSES: JobStatus[] = ["DRAFT", "OPEN"];
