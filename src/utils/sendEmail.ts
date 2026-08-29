// src/utils/sendEmail.ts
import { Resend } from "resend";
import { env } from "../config/env";
import ApiError from "./ApiError";

const resend = new Resend(env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({
  to,
  subject,
  html,
}: SendEmailOptions): Promise<void> => {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
  if (error) {
    console.error("[Email] Resend API error:", JSON.stringify(error, null, 2));
    // In development, a failed send is logged but NOT fatal — the dev
    // console.log fallbacks below give you what you need to keep testing.
    // In production, a failed send IS a real problem the caller must know about.
    if (env.NODE_ENV !== "development") {
      throw new ApiError(500, "Failed to send email");
    }
  }
};

export const sendVerificationOtpEmail = async (
  to: string,
  name: string,
  otp: string,
) => {
  if (env.NODE_ENV === "development") {
    console.log(`\n🔐 [DEV] Verification code for ${to}: ${otp}\n`);
  }
  await sendEmail({
    to,
    subject: "Your Nexora verification code",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>Hi ${name},</h2>
      <p>Your verification code is:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;">${otp}</p>
      <p style="color:#666;font-size:13px;">This code expires in 10 minutes.</p>
    </div>`,
  });
};

export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  rawToken: string,
) => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  if (env.NODE_ENV === "development") {
    console.log(`\n📧 [DEV] Reset link for ${to}:\n${resetUrl}\n`);
  }

  await sendEmail({
    to,
    subject: "Reset your Nexora password",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>Hi ${name},</h2>
      <p>We received a request to reset your password.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
      <p style="color:#666;font-size:13px;margin-top:16px;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>`,
  });
};
