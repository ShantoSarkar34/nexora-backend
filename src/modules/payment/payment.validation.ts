import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

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

export const listTransactionsSchema = z.object({
  query: z.object({
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});
