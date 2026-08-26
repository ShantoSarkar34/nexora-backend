import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import notFound from "./middleware/notFound";
import errorHandler from "./middleware/errorHandler";
import catchAsync from "./utils/catchAsync";
import sendResponse from "./utils/sendResponse";
import prisma from "./config/prismaClient";
import redisService from "./utils/redisService";

const app: Application = express();

// Core middleware
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get(
  "/api/v1/health",
  catchAsync(async (req: Request, res: Response) => {
    await prisma.$queryRaw`SELECT 1`;

    // Exercise Redis: set → get → ttl → delete
    const testKey = "health:check";
    await redisService.set(testKey, "ok", 30);
    const value = await redisService.get(testKey);
    const ttl = await redisService.ttl(testKey);
    await redisService.delete(testKey);

    sendResponse(res, 200, {
      success: true,
      message: "Nexora API is healthy",
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        database: "connected",
        redis: value === "ok" ? "connected" : "unreachable",
        redisTtlSample: ttl,
      },
    });
  })
);

// 404 — must come after all real routes
app.use(notFound);

// Centralized error handler — must always be last
app.use(errorHandler);

export default app;
