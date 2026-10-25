import { Request, Response, NextFunction } from "express";
import { verifyJwt, JwtPayload } from "../utils/jwt";
import ApiError from "../utils/ApiError";
import prisma from "../config/prismaClient";
import catchAsync from "../utils/catchAsync";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.accessToken;
    if (!token) {
      throw new ApiError(401, "You are not logged in");
    }

    let payload: JwtPayload;
    try {
      payload = verifyJwt(token);
    } catch {
      throw new ApiError(
        401,
        "Session expired or invalid, please log in again",
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || user.deletedAt) {
      throw new ApiError(401, "User no longer exists");
    }

    if (user.isSuspended) {
      throw new ApiError(403, "Account suspended");
    }

    if (
      user.passwordChangedAt &&
      payload.iat &&
      user.passwordChangedAt.getTime() > payload.iat * 1000
    ) {
      throw new ApiError(
        401,
        "Password was recently changed, please log in again",
      );
    }

    req.user = payload;
    next();
  },
);
