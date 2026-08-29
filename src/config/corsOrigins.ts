import { env } from "./env";

const additionalOrigins = env.ADDITIONAL_ALLOWED_ORIGINS
  ? env.ADDITIONAL_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

export const allowedOrigins = [env.FRONTEND_URL, ...additionalOrigins];

export const isVercelPreviewOrigin = (origin: string): boolean =>
  /^https:\/\/find-nexora-[a-z0-9-]+\.vercel\.app$/.test(origin);
