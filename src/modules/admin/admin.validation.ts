import { z } from "zod";

// "?role=" (empty) should mean "not provided", not an error.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const adminListUsersSchema = z.object({
  query: z.object({
    role: z.preprocess(
      emptyToUndefined,
      z.enum(["CLIENT", "FREELANCER", "ADMIN"]).optional(),
    ),
    search: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(100).optional(),
    ),
    isVerified: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    ),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const adminListJobsSchema = z.object({
  query: z.object({
    status: z.preprocess(
      emptyToUndefined,
      z
        .enum([
          "DRAFT",
          "OPEN",
          "IN_PROGRESS",
          "COMPLETED",
          "CANCELLED",
          "CLOSED",
        ])
        .optional(),
    ),
    search: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(100).optional(),
    ),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const suspendUserSchema = z.object({
  body: z.object({
    suspended: z.boolean(),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const forceCloseJobSchema = z.object({
  body: z.object({
    status: z.enum(["CLOSED", "CANCELLED"]),
    note: z.string().trim().max(500).optional(),
  }),
});
