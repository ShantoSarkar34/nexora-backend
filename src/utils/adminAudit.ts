import { Prisma } from "../../generated/prisma";

export type AdminActionName =
  | "USER_SUSPENDED"
  | "USER_UNSUSPENDED"
  | "JOB_FORCE_CLOSED"
  | "DISPUTE_RESOLVED";
export type AdminTargetType = "USER" | "JOB" | "DISPUTE";

interface AdminActionInput {
  adminId: string;
  action: AdminActionName;
  targetType: AdminTargetType;
  targetId: string;
  note?: string | null;
}

// Returns an un-awaited Prisma operation so the audit row can sit in the same
// transaction as the change it records. Every admin mutation must call this.
export const logAdminAction = (
  client: Pick<Prisma.TransactionClient, "adminAction">,
  input: AdminActionInput,
) =>
  client.adminAction.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      note: input.note ?? null,
    },
  });
