import { NotificationType } from "../../../generated/prisma/client";

export interface INotifyPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export interface INotificationListQuery {
  unreadOnly?: string;
  page?: string;
  limit?: string;
}
