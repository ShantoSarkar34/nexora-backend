// src/modules/user/user.constants.ts  (NEW FILE)
import { Prisma } from "../../../generated/prisma";

// Single source of truth for the "current user" shape returned by
// GET /auth/me, PATCH /users/me and POST /users/avatar.
export const CURRENT_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isVerified: true,
  provider: true,
  imageUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
