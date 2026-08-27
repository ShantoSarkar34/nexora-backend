import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import {
  INotifyPayload,
  INotificationListQuery,
} from "./notification.interface";


export const notifyUser = async (payload: INotifyPayload): Promise<void> => {
  try {
    await prisma.notification.create({ data: payload });
  } catch (error) {
    console.error(
      `[Notification] Failed to create notification for user ${payload.userId}:`,
      error
    );
  }
};

export const getMyNotifications = async (
  userId: string,
  query: INotificationListQuery
) => {
  const { skip, take, page, limit } = getPagination(query);
  const where = {
    userId,
    ...(query.unreadOnly === "true" && { isRead: false }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, meta: buildMeta(total, page, limit) };
};

export const getUnreadCount = async (userId: string) => {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount: count };
};

export const markAsRead = async (
  notificationId: string,
  currentUser: JwtPayload
) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) throw new ApiError(404, "Notification not found");
  checkOwnership(notification.userId, currentUser);

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

export const markAllAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updatedCount: result.count };
};
