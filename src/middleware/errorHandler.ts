import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import ApiError from "../utils/ApiError";
import { env } from "../config/env";
import { Prisma } from "../../generated/prisma/client";

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = "Something went wrong";
  let errors: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    errors = err.flatten().fieldErrors;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        statusCode = 409;
        message = "A record with this value already exists";
        break;
      case "P2025":
        statusCode = 404;
        message = "Record not found";
        break;
      case "P2023":
        statusCode = 400;
        message = "Invalid ID format";
        break;
      default:
        statusCode = 400;
        message = "Database request error";
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = "Invalid request data";
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (env.NODE_ENV === "development") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(env.NODE_ENV === "development" && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
};

export default errorHandler;
