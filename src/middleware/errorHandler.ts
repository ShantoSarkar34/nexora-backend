// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import multer from "multer";
import ApiError from "../utils/ApiError";
import { env } from "../config/env";
import { Prisma } from "../../generated/prisma";

const REQUEST_SCOPES = ["body", "query", "params"];

const toFieldErrors = (err: ZodError): Record<string, string[]> => {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const [first, ...rest] = issue.path;
    const path = REQUEST_SCOPES.includes(String(first)) ? rest : issue.path;
    const key = path.length > 0 ? path.map(String).join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
};

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
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
    errors = toFieldErrors(err);
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
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = err.message;
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
