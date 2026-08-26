import { z } from "zod";

const jobCategoryEnum = z.enum([
  "WEB_DEVELOPMENT",
  "MOBILE_DEVELOPMENT",
  "DESIGN",
  "WRITING",
  "MARKETING",
  "DATA_SCIENCE",
  "DEVOPS",
  "OTHER",
]);
const budgetTypeEnum = z.enum(["FIXED", "HOURLY"]);
const experienceLevelEnum = z.enum(["ENTRY", "INTERMEDIATE", "EXPERT"]);
const jobStatusEnum = z.enum([
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
]);

export const createJobSchema = z.object({
  body: z
    .object({
      title: z.string().min(5).max(150),
      description: z.string().min(20).max(5000),
      category: jobCategoryEnum,
      budgetType: budgetTypeEnum,
      budgetMin: z.coerce.number().positive(),
      budgetMax: z.coerce.number().positive(),
      experienceLevel: experienceLevelEnum,
      deadline: z.coerce.date().optional(),
      skills: z
        .array(z.string().min(1))
        .min(1, "At least one skill is required"),
    })
    .refine((data) => data.budgetMax >= data.budgetMin, {
      message: "budgetMax must be greater than or equal to budgetMin",
      path: ["budgetMax"],
    }),
});

export const updateJobSchema = z.object({
  body: z
    .object({
      title: z.string().min(5).max(150).optional(),
      description: z.string().min(20).max(5000).optional(),
      category: jobCategoryEnum.optional(),
      budgetType: budgetTypeEnum.optional(),
      budgetMin: z.coerce.number().positive().optional(),
      budgetMax: z.coerce.number().positive().optional(),
      experienceLevel: experienceLevelEnum.optional(),
      deadline: z.coerce.date().optional(),
      skills: z.array(z.string().min(1)).optional(),
    })
    .refine(
      (data) =>
        data.budgetMin === undefined || data.budgetMax === undefined
          ? true
          : data.budgetMax >= data.budgetMin,
      {
        message: "budgetMax must be greater than or equal to budgetMin",
        path: ["budgetMax"],
      }
    ),
});

export const updateJobStatusSchema = z.object({
  body: z.object({ status: jobStatusEnum }),
});

export const listJobsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: jobCategoryEnum.optional(),
    budgetType: budgetTypeEnum.optional(),
    experienceLevel: experienceLevelEnum.optional(),
    minBudget: z.coerce.number().optional(),
    maxBudget: z.coerce.number().optional(),
    sortBy: z.enum(["newest", "budget_asc", "budget_desc"]).default("newest"),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
