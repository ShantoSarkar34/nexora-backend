export const REDIS_KEYS = {
  emailVerificationOtp: (userId: string) => `auth:verify-otp:${userId}`,
  emailVerificationAttempts: (userId: string) =>
    `auth:verify-attempts:${userId}`,
  passwordReset: (hashedToken: string) => `auth:reset:${hashedToken}`,
  resendCooldown: (userId: string) => `auth:resend-cooldown:${userId}`,
};

export const TTL = {
  EMAIL_VERIFICATION_OTP: 10 * 60,
  PASSWORD_RESET: 15 * 60,
  RESEND_COOLDOWN: 60,
};
