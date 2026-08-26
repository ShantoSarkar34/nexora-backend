import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import { Role } from "../../prisma/generated/client";

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      // Should never actually hit this if `authenticate` runs first,
      // but guards against someone forgetting to chain it.
      throw new ApiError(401, "You are not logged in");
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "You do not have permission to perform this action");
    }
    next();
  };
};