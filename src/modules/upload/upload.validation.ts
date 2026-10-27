import { z } from "zod";
import {
  ALLOWED_TYPES_LABEL,
  MAX_ATTACHMENT_BYTES,
  fileNameMatchesMimeType,
  isAllowedMimeType,
} from "./upload.constants";

const mimeTypeField = z
  .string()
  .trim()
  .refine(isAllowedMimeType, {
    message: `Unsupported file type. Allowed: ${ALLOWED_TYPES_LABEL}`,
  });

export const signUploadSchema = z.object({
  body: z
    .object({
      purpose: z.literal("submission"),
      fileName: z.string().trim().min(1).max(200),
      mimeType: mimeTypeField,
      size: z.coerce
        .number()
        .int()
        .positive()
        .max(MAX_ATTACHMENT_BYTES, "File must be 10 MB or smaller"),
    })
    .refine(
      (body) =>
        !isAllowedMimeType(body.mimeType) ||
        fileNameMatchesMimeType(body.fileName, body.mimeType),
      {
        message: "The file name's extension doesn't match its type",
        path: ["fileName"],
      },
    ),
});

// Reused by the contract submit schema.
export const attachmentSchema = z.object({
  url: z.string().url().max(500),
  name: z.string().trim().min(1).max(200),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_ATTACHMENT_BYTES, "File must be 10 MB or smaller"),
  mimeType: mimeTypeField,
});
