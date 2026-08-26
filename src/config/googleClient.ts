// src/config/googleClient.ts
import { OAuth2Client } from "google-auth-library";
import { env } from "./env";

export const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);