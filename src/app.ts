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
import authRoutes from "./modules/auth/auth.routes";
import freelancerProfileRoutes from "./modules/freelancer-profile/freelancer-profile.routes";
import clientProfileRoutes from "./modules/client-profile/client-profile.routes";
import jobRoutes from "./modules/job/job.routes";
import applicationRoutes from "./modules/application/application.routes";
import contractRoutes from "./modules/contract/contract.routes";
import reviewRoutes from "./modules/review/review.routes";



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

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/profiles/freelancer", freelancerProfileRoutes);
app.use("/api/v1/profiles/client", clientProfileRoutes);

// jobs route
app.use("/api/v1/jobs", jobRoutes);
// applications route
app.use("/api/v1/applications", applicationRoutes);
// contracts route
app.use("/api/v1/contracts", contractRoutes);
// review route
app.use("/api/v1/reviews", reviewRoutes);




// 404 — must come after all real routes
app.use(notFound);

// Centralized error handler — must always be last
app.use(errorHandler);

export default app;
