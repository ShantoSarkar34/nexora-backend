// src/modules/user/user.validation.ts
import { z } from "zod";

export const updateMeSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters"),
  }),
});

export const deleteAccountSchema = z.object({
  body: z
    .object({
      password: z.string().min(1).optional(),
      confirmEmail: z.string().email().optional(),
    })
    .refine((data) => data.password || data.confirmEmail, {
      message:
        "Provide your password (or your account email if you signed up with Google)",
    }),
});
