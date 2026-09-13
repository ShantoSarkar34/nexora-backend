// src/middleware/upload.middleware.ts
import multer from "multer";
import ApiError from "../utils/ApiError";

const storage = multer.memoryStorage(); // no disk writes — Vercel's serverless filesystem is ephemeral/read-only for this purpose

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB — see the Vercel note below
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new ApiError(400, "Only image files are allowed"));
    }
    cb(null, true);
  },
});

export const uploadSingleImage = upload.single("image");
