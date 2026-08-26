// src/middleware/validateRequest.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import catchAsync from "../utils/catchAsync";

const validateRequest = (schema: z.ZodTypeAny) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
    next();
  });

export default validateRequest;