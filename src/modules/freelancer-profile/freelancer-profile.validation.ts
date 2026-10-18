import { z } from "zod";

export const createFreelancerProfileSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(100).optional(),
    bio: z.string().max(2000).optional(),
    hourlyRate: z.coerce.number().positive().optional(),
    experienceLevel: z.enum(["ENTRY", "INTERMEDIATE", "EXPERT"]).optional(),
    availability: z.enum(["AVAILABLE", "BUSY", "NOT_AVAILABLE"]).optional(),
  }),
});

export const updateFreelancerProfileSchema = createFreelancerProfileSchema;

export const addSkillSchema = z.object({
  body: z.object({ name: z.string().min(1).max(50) }),
});

export const experienceSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(150),
    company: z.string().min(1).max(150),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.boolean().default(false),
    description: z.string().max(1000).optional(),
  }),
});

export const portfolioSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(150),
    description: z.string().max(1000).optional(),
    projectUrl: z.string().url().optional(),
    imageUrl: z.string().url().optional(),
  }),
});

// "?minRate=" or "?availability=" (empty) should mean "not provided", not an error.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const listFreelancersSchema = z.object({
  query: z
    .object({
      search: z.preprocess(
        emptyToUndefined,
        z.string().trim().max(100).optional(),
      ),
      skills: z.preprocess(
        emptyToUndefined,
        z.string().trim().max(500).optional(),
      ),
      experienceLevel: z.preprocess(
        emptyToUndefined,
        z.enum(["ENTRY", "INTERMEDIATE", "EXPERT"]).optional(),
      ),
      availability: z.preprocess(
        emptyToUndefined,
        z.enum(["AVAILABLE", "BUSY", "NOT_AVAILABLE"]).optional(),
      ),
      minRate: z.preprocess(
        emptyToUndefined,
        z.coerce.number().min(0).optional(),
      ),
      maxRate: z.preprocess(
        emptyToUndefined,
        z.coerce.number().min(0).optional(),
      ),
      minRating: z.preprocess(
        emptyToUndefined,
        z.coerce.number().min(1).max(5).optional(),
      ),
      sortBy: z.preprocess(
        emptyToUndefined,
        z.enum(["newest", "rate_asc", "rate_desc", "rating"]).default("newest"),
      ),
      page: z.preprocess(emptyToUndefined, z.string().optional()),
      limit: z.preprocess(emptyToUndefined, z.string().optional()),
    })
    .refine(
      (query) =>
        query.minRate === undefined ||
        query.maxRate === undefined ||
        query.maxRate >= query.minRate,
      {
        message: "maxRate must be greater than or equal to minRate",
        path: ["maxRate"],
      },
    ),
});
