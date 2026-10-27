export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENTS = 5;

interface AttachmentTypeRule {
  // Extensions a file of this type may have (lowercase, no dot).
  extensions: string[];
  // Extension written into the stored name for raw files.
  storageExtension: string;
  // Cloudinary resource type: images go through the image pipeline, everything else is raw.
  resourceType: "image" | "raw";
}

export const ALLOWED_ATTACHMENT_TYPES: Record<string, AttachmentTypeRule> = {
  "application/pdf": {
    extensions: ["pdf"],
    storageExtension: "pdf",
    resourceType: "raw",
  },
  "application/zip": {
    extensions: ["zip"],
    storageExtension: "zip",
    resourceType: "raw",
  },
  // Chrome on Windows reports .zip files with this type.
  "application/x-zip-compressed": {
    extensions: ["zip"],
    storageExtension: "zip",
    resourceType: "raw",
  },
  "image/png": {
    extensions: ["png"],
    storageExtension: "png",
    resourceType: "image",
  },
  "image/jpeg": {
    extensions: ["jpg", "jpeg"],
    storageExtension: "jpg",
    resourceType: "image",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: ["docx"],
    storageExtension: "docx",
    resourceType: "raw",
  },
  "text/plain": {
    extensions: ["txt"],
    storageExtension: "txt",
    resourceType: "raw",
  },
};

export const ALLOWED_TYPES_LABEL = "PDF, ZIP, PNG, JPG, DOCX or TXT";

export const isAllowedMimeType = (mimeType: string): boolean =>
  Object.hasOwn(ALLOWED_ATTACHMENT_TYPES, mimeType);

// Catches "malware.exe" declared as a PDF.
export const fileNameMatchesMimeType = (
  fileName: string,
  mimeType: string,
): boolean => {
  if (!isAllowedMimeType(mimeType)) return false;
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_ATTACHMENT_TYPES[mimeType].extensions.includes(extension);
};
