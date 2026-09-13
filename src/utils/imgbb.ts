import { env } from "../config/env";
import ApiError from "./ApiError";

interface ImgbbResponse {
  success: boolean;
  data?: { url: string; display_url: string };
  error?: { message: string };
}

export const uploadToImgbb = async (fileBuffer: Buffer): Promise<string> => {
  const base64Image = fileBuffer.toString("base64");

  const formData = new FormData();
  formData.append("image", base64Image);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${env.IMGBB_API_KEY}`,
    {
      method: "POST",
      body: formData,
    },
  );

  const result = (await response.json()) as ImgbbResponse;

  if (!result.success || !result.data?.url) {
    console.error("[ImgBB] Upload failed:", result);
    throw new ApiError(502, "Image upload failed. Please try again.");
  }

  return result.data.url;
};
