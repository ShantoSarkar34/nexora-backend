import { z } from "zod";
import { attachmentSchema } from "../upload/upload.validation";
import { MAX_ATTACHMENTS } from "../upload/upload.constants";

export const submitWorkSchema = z.object({
  body: z
    .object({
      submissionNote: z.string().max(2000).optional(),
      submissionUrl: z.string().url().optional(),
      attachments: z
        .array(attachmentSchema)
        .max(MAX_ATTACHMENTS, `You can attach at most ${MAX_ATTACHMENTS} files`)
        .optional(),
    })
    .refine(
      (data) =>
        data.submissionNote ||
        data.submissionUrl ||
        (data.attachments && data.attachments.length > 0),
      {
        message:
          "Provide a submission note, a submission URL or at least one attachment",
      },
    ),
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
