import { z } from "zod";
const currentYear = new Date().getFullYear();

export const createClientProfileSchema = z.object({
  body: z.object({
    companyName: z.string().min(1).max(150).optional(),
    industry: z.string().max(100).optional(),
    companySize: z.enum(["SOLO", "SMALL", "MEDIUM", "LARGE"]).optional(),
    website: z.string().url().optional(),
    about: z.string().max(2000).optional(),
    location: z.string().max(150).optional(),
    foundedYear: z.coerce.number().int().min(1800).max(currentYear).optional(),
    linkedinUrl: z.string().url().optional(),
    twitterUrl: z.string().url().optional(),
  }),
});

export const updateClientProfileSchema = createClientProfileSchema;
