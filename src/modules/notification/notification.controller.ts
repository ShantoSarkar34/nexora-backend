import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as notificationService from "./notification.service";

export const getMyNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const { notifications, meta } =
      await notificationService.getMyNotifications(
        req.user!.userId,
        req.query as any
      );
    sendResponse(res, 200, {
      success: true,
      message: "Notifications fetched",
      data: notifications,
      meta,
    });
  }
);

export const getUnreadCount = catchAsync(
  async (req: Request, res: Response) => {
    const result = await notificationService.getUnreadCount(req.user!.userId);
    sendResponse(res, 200, {
      success: true,
      message: "Unread count fetched",
      data: result,
    });
  }
);

export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const notification = await notificationService.markAsRead(
    getParam(req, "notificationId"),
    req.user!
  );
  sendResponse(res, 200, {
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationService.markAllAsRead(req.user!.userId);
  sendResponse(res, 200, {
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
});
