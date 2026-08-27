import { z } from "zod";

export const submitWorkSchema = z.object({
  body: z
    .object({
      submissionNote: z.string().max(2000).optional(),
      submissionUrl: z.string().url().optional(),
    })
    .refine((data) => data.submissionNote || data.submissionUrl, {
      message: "Provide at least a submission note or a submission URL",
    }),
});

export const cancelContractSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(10, "Please provide a reason (at least 10 characters)")
      .max(1000),
  }),
});

export const listContractsQuerySchema = z.object({
  query: z.object({
    status: z
      .enum([
        "PENDING",
        "ACTIVE",
        "SUBMITTED",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
      ])
      .optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
