import { z } from "zod";

export const createApplicationSchema = z.object({
  body: z.object({
    jobId: z.string().uuid(),
    coverLetter: z
      .string()
      .min(50, "Cover letter must be at least 50 characters")
      .max(3000),
    proposedBudget: z.coerce.number().positive(),
    estimatedDeliveryDays: z.coerce.number().int().positive(),
  }),
});

export const updateApplicationStatusSchema = z.object({
  body: z.object({
    status: z.enum(["SHORTLISTED", "REJECTED"]),
  }),
});

export const listApplicationsQuerySchema = z.object({
  query: z.object({
    status: z
      .enum(["PENDING", "SHORTLISTED", "REJECTED", "HIRED", "WITHDRAWN"])
      .optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
