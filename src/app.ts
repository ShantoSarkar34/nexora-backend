import express, { Application, Request, Response } from "express";

const app: Application = express();


app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Nexora API is running",
  });
});

export default app;