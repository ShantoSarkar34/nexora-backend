import { z } from "zod";

export const analyzeMatchSchema = z.object({
  params: z.object({ jobId: z.string().uuid() }),
});

// Validates the AI's JSON response before we trust or store it.
export const aiMatchResponseSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()).max(10),
  missingSkills: z.array(z.string()).max(10),
  recommendation: z.string().min(1).max(1000),
});
