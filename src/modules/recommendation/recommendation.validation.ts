import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const recommendedJobsSchema = z.object({
  query: z.object({
    limit: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(30).default(10),
    ),
  }),
});
