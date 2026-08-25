import { Response } from "express";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

const sendResponse = <T>(
  res: Response,
  statusCode: number,
  payload: ApiResponse<T>
) => {
  res.status(statusCode).json(payload);
};

export default sendResponse;
