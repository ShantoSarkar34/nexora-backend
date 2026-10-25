import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const openDisputeSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .trim()
      .min(20, "Please describe the problem in at least 20 characters")
      .max(2000, "Reason must be at most 2000 characters"),
  }),
});

export const listDisputesSchema = z.object({
  query: z.object({
    status: z.preprocess(
      emptyToUndefined,
      z.enum(["OPEN", "RESOLVED", "WITHDRAWN"]).optional(),
    ),
    contractId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const resolveDisputeSchema = z.object({
  body: z.object({
    resolution: z.enum(["REFUND_CLIENT", "RELEASE_TO_FREELANCER", "NO_ACTION"]),
    note: z
      .string()
      .trim()
      .min(10, "Add a note of at least 10 characters explaining the decision")
      .max(2000),
  }),
});
