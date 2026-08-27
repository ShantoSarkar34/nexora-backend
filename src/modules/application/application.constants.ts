import { ApplicationStatus } from "../../../generated/prisma/client";

// Full map of what CAN follow what, in principle.
export const APPLICATION_STATUS_TRANSITIONS: Record<
  ApplicationStatus,
  ApplicationStatus[]
> = {
  PENDING: ["SHORTLISTED", "REJECTED", "WITHDRAWN", "HIRED"],
  SHORTLISTED: ["REJECTED", "WITHDRAWN", "HIRED"],
  REJECTED: [],
  HIRED: [],
  WITHDRAWN: [],
};

// What the CLIENT is allowed to set via this phase's endpoints.
// HIRED is deliberately excluded here — Phase 9 owns that transition,
// since hiring also creates a Contract in the same atomic operation.
export const CLIENT_ALLOWED_TARGET_STATUSES: ApplicationStatus[] = [
  "SHORTLISTED",
  "REJECTED",
];

// Statuses a freelancer may withdraw FROM.
export const WITHDRAWABLE_STATUSES: ApplicationStatus[] = [
  "PENDING",
  "SHORTLISTED",
];
