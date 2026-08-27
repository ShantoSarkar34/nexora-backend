import { z } from "zod";

export const createReviewSchema = z.object({
  body: z.object({
    rating: z.coerce
      .number()
      .int()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating cannot exceed 5"),
    comment: z.string().max(1000).optional(),
  }),
});

export const listReviewsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
