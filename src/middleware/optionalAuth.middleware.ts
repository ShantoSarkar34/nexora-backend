import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt";
import prisma from "../config/prismaClient";
import catchAsync from "../utils/catchAsync";

export const optionalAuthenticate = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.accessToken;

    if (token) {
      try {
        const payload = verifyJwt(token);
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { deletedAt: true, passwordChangedAt: true },
        });

        const isStale =
          !!user?.passwordChangedAt &&
          !!payload.iat &&
          user.passwordChangedAt.getTime() > payload.iat * 1000;

        if (user && !user.deletedAt && !isStale) {
          req.user = payload;
        }
      } catch {
        // Treat any failure as anonymous so a public endpoint never breaks.
      }
    }

    next();
  },
);
