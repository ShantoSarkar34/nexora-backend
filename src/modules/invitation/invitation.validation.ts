import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const invitationStatusEnum = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
]);

export const createInvitationSchema = z.object({
  body: z.object({
    jobId: z.string().uuid(),
    freelancerId: z.string().uuid(),
    message: z
      .string()
      .max(500, "Message must be at most 500 characters")
      .optional(),
  }),
});

export const respondInvitationSchema = z.object({
  body: z.object({
    status: z.enum(["ACCEPTED", "DECLINED"]),
  }),
});

export const listMyInvitationsSchema = z.object({
  query: z.object({
    status: z.preprocess(emptyToUndefined, invitationStatusEnum.optional()),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const listSentInvitationsSchema = z.object({
  query: z.object({
    jobId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    status: z.preprocess(emptyToUndefined, invitationStatusEnum.optional()),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});
