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
