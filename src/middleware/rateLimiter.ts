import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import redisService from "../utils/redisService";

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
}

export const rateLimiter = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = options.keyGenerator
        ? options.keyGenerator(req)
        : req.ip ?? "unknown";
      const key = `ratelimit:${options.keyPrefix}:${identifier}`;
      const count = await redisService.increment(key, options.windowSeconds);

      res.setHeader("X-RateLimit-Limit", options.maxRequests);
      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, options.maxRequests - count)
      );

      if (count > options.maxRequests) {
        throw new ApiError(429, "Too many requests. Please try again later.");
      }
      next();
    } catch (error) {
      if (error instanceof ApiError) return next(error);
      console.error("[RateLimiter] Redis error, failing open:", error);
      next();
    }
  };
};
