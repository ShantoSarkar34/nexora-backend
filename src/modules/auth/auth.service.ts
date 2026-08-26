import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { hashPassword, comparePassword } from "../../utils/hashPassword";
import { generateSecureToken, hashToken } from "../../utils/generateToken";
import { generateOtp, hashOtp } from "../../utils/otp";
import { signJwt } from "../../utils/jwt";
import redisService from "../../utils/redisService";
import { sendVerificationOtpEmail, sendPasswordResetEmail } from "../../utils/sendEmail";
import { googleClient } from "../../config/googleClient";
import { env } from "../../config/env";
import { REDIS_KEYS, TTL } from "./auth.constants";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: "CLIENT" | "FREELANCER";
}

export const registerUser = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new ApiError(409, "Unable to register with these details");
  }

  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role,
      provider: "LOCAL",
    },
  });

  // No email sent here anymore — verification is now a deliberate,
  // authenticated action the user takes later from their dashboard.
  return { id: user.id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified };
};

export const loginUser = async ({ email, password }: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.password) {
    throw new ApiError(400, "This account uses Google Sign-In. Please continue with Google.");
  }

  if (!(await comparePassword(password, user.password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Verification is no longer required to log in — it's checked later,
  // per-action, wherever a module actually needs a verified account
  // (e.g. posting a job, applying) rather than gating the whole session.
  const token = signJwt({ userId: user.id, role: user.role });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified },
  };
};

export const sendVerificationOtp = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  if (user.isVerified) throw new ApiError(400, "Account is already verified");

  const cooldownKey = REDIS_KEYS.resendCooldown(userId);
  if (await redisService.exists(cooldownKey)) {
    throw new ApiError(429, "Please wait before requesting another code");
  }

  const otp = generateOtp();
  await redisService.set(REDIS_KEYS.emailVerificationOtp(userId), hashOtp(otp), TTL.EMAIL_VERIFICATION_OTP);
  await redisService.delete(REDIS_KEYS.emailVerificationAttempts(userId)); // fresh code = fresh attempt count
  await redisService.set(cooldownKey, "1", TTL.RESEND_COOLDOWN);

  await sendVerificationOtpEmail(user.email, user.name, otp);
};

export const verifyOtp = async (userId: string, otp: string) => {
  const otpKey = REDIS_KEYS.emailVerificationOtp(userId);
  const attemptsKey = REDIS_KEYS.emailVerificationAttempts(userId);

  const storedHash = await redisService.get(otpKey);
  if (!storedHash) {
    throw new ApiError(400, "Code has expired or was never requested. Please request a new one.");
  }

  const attempts = Number((await redisService.get(attemptsKey)) ?? "0");
  if (attempts >= 5) {
    await redisService.delete(otpKey);
    throw new ApiError(429, "Too many incorrect attempts. Please request a new code.");
  }

  if (hashOtp(otp) !== storedHash) {
    await redisService.set(attemptsKey, String(attempts + 1), TTL.EMAIL_VERIFICATION_OTP);
    throw new ApiError(400, "Incorrect code");
  }

  await prisma.user.update({ where: { id: userId }, data: { isVerified: true } });
  await redisService.delete(otpKey);
  await redisService.delete(attemptsKey);
};

export const googleAuth = async ({ idToken, role }: { idToken: string; role?: "CLIENT" | "FREELANCER" }) => {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new ApiError(400, "Invalid Google token");
  }

  let user = await prisma.user.findUnique({ where: { email: payload.email } });

  if (!user) {
    if (!role) {
      throw new ApiError(400, "Role is required to complete sign-up");
    }
    user = await prisma.user.create({
      data: {
        name: payload.name ?? payload.email.split("@")[0],
        email: payload.email,
        provider: "GOOGLE",
        googleId: payload.sub,
        role,
        isVerified: true, // Google already proved they own this email
      },
    });
  } else if (user.provider === "LOCAL" && !user.googleId) {
    // Same email already registered locally — link accounts instead of duplicating
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub, isVerified: true },
    });
  }

  const token = signJwt({ userId: user.id, role: user.role });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified },
  };
};

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return; // Google-only accounts have nothing to reset; same silent response either way

  const { rawToken, hashedToken } = generateSecureToken();
  await redisService.set(REDIS_KEYS.passwordReset(hashedToken), user.id, TTL.PASSWORD_RESET);
  await sendPasswordResetEmail(user.email, user.name, rawToken);
};

export const resetPassword = async (rawToken: string, newPassword: string) => {
  const key = REDIS_KEYS.passwordReset(hashToken(rawToken));
  const userId = await redisService.get(key);
  if (!userId) {
    throw new ApiError(400, "Reset link is invalid or has expired");
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, passwordChangedAt: new Date() },
  });
  await redisService.delete(key);
};