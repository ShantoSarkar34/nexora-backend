import { z } from "zod";

export const listPaymentsQuerySchema = z.object({
  query: z.object({
    status: z
      .enum([
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ])
      .optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
