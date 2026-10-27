import crypto from "crypto";
import { env } from "../config/env";
import ApiError from "./ApiError";

export const getCloudinaryConfig = () => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new ApiError(503, "File uploads are not configured on this server");
  }
  return { cloudName, apiKey, apiSecret };
};

export const signCloudinaryParams = (
  params: Record<string, string | number>,
  apiSecret: string,
): string => {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const submissionFolderFor = (userId: string): string =>
  `nexora/submissions/${userId}/`;

// True only for a file this user uploaded to OUR Cloudinary account through /uploads/sign.
export const isOwnedCloudinaryUrl = (
  rawUrl: string,
  userId: string,
): boolean => {
  const { cloudName } = getCloudinaryConfig();

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    url.search ||
    url.hash
  ) {
    return false;
  }

  const pattern = new RegExp(
    `^/${escapeRegExp(cloudName)}/(?:image|raw)/upload/(?:v\\d+/)?${escapeRegExp(submissionFolderFor(userId))}[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9]+)?$`,
  );
  return pattern.test(url.pathname);
};
