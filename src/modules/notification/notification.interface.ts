import { NotificationType, NotificationEntityType } from "../../../generated/prisma";

export interface INotifyPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  meta?: Record<string, string>;
}

export interface INotificationListQuery {
  unreadOnly?: string;
  page?: string;
  limit?: string;
}