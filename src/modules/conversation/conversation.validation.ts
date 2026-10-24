import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const createConversationSchema = z.object({
  body: z.object({
    jobId: z.string().uuid(),
    otherUserId: z.string().uuid(),
  }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    body: z
      .string()
      .trim()
      .min(1, "Message can't be empty")
      .max(2000, "Message must be at most 2000 characters"),
  }),
});

export const listConversationsSchema = z.object({
  query: z.object({
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const listMessagesSchema = z.object({
  query: z
    .object({
      limit: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(1).max(100).default(30),
      ),
      before: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
      after: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    })
    .refine((query) => !(query.before && query.after), {
      message: "Use either before or after, not both",
      path: ["after"],
    }),
});
