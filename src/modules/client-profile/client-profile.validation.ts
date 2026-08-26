import { z } from "zod";

export const createClientProfileSchema = z.object({
  body: z.object({
    companyName: z.string().min(1).max(150).optional(),
    industry: z.string().max(100).optional(),
    companySize: z.enum(["SOLO", "SMALL", "MEDIUM", "LARGE"]).optional(),
    website: z.string().url().optional(),
    about: z.string().max(2000).optional(),
  }),
});

export const updateClientProfileSchema = createClientProfileSchema;
