import crypto from "crypto";
import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { JwtPayload } from "../../utils/jwt";
import {
  getCloudinaryConfig,
  isOwnedCloudinaryUrl,
  signCloudinaryParams,
  submissionFolderFor,
} from "../../utils/cloudinary";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "./upload.constants";
import { IAttachment, ISignUploadInput } from "./upload.interface";

const SIGNATURE_LIFETIME_SECONDS = 60 * 60; // Cloudinary accepts a signature for one hour

export const signUpload = async (
  viewer: JwtPayload,
  input: ISignUploadInput,
) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

  // Work can only be submitted on an ACTIVE contract, so nobody else gets free storage.
  const activeContracts = await prisma.contract.count({
    where: { freelancerId: viewer.userId, status: "ACTIVE" },
  });
  if (activeContracts === 0) {
    throw new ApiError(
      403,
      "You need an active contract before you can upload work files",
    );
  }

  const rule = ALLOWED_ATTACHMENT_TYPES[input.mimeType];
  if (!rule) throw new ApiError(400, "Unsupported file type");

  // The server picks the name: a random id inside this freelancer's own folder.
  // Raw files keep their extension in the id (Cloudinary requires it for raw uploads).
  const randomId = crypto.randomBytes(16).toString("hex");
  const publicId = `${submissionFolderFor(viewer.userId)}${randomId}${rule.resourceType === "raw" ? `.${rule.storageExtension}` : ""}`;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinaryParams(
    { public_id: publicId, timestamp },
    apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${rule.resourceType}/upload`,
    method: "POST" as const,
    resourceType: rule.resourceType,
    // Send exactly these as form fields, plus the file. Any extra field breaks the signature.
    fields: { api_key: apiKey, timestamp, public_id: publicId, signature },
    fileFieldName: "file" as const,
    maxSizeBytes: MAX_ATTACHMENT_BYTES,
    expiresAt: new Date(
      (timestamp + SIGNATURE_LIFETIME_SECONDS) * 1000,
    ).toISOString(),
  };
};

// Every attachment must be a file this user uploaded through /uploads/sign.
// Returns the list with duplicate URLs collapsed.
export const assertAttachmentsOwnedBy = (
  userId: string,
  attachments: IAttachment[],
): IAttachment[] => {
  const unique = [
    ...new Map(
      attachments.map((attachment) => [attachment.url, attachment]),
    ).values(),
  ];

  for (const attachment of unique) {
    if (!isOwnedCloudinaryUrl(attachment.url, userId)) {
      throw new ApiError(
        400,
        `"${attachment.name}" wasn't uploaded through Nexora. Upload it again and retry.`,
      );
    }
  }

  return unique;
};
