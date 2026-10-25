import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { Prisma } from "../../../generated/prisma";
import { notifyUser } from "../notification/notification.service";
import {
  ICreateConversation,
  IConversationListQuery,
  IMessageListQuery,
} from "./conversation.interface";

const conversationInclude = {
  job: { select: { id: true, title: true } },
  client: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      role: true,
      deletedAt: true,
      isSuspended: true,
    },
  },
  freelancer: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      role: true,
      deletedAt: true,
      isSuspended: true,
    },
  },
} satisfies Prisma.ConversationInclude;

type ConversationWithDetails = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

// A user has exactly one role, so filtering on that one column keeps the index usable.
const participantFilter = (user: JwtPayload): Prisma.ConversationWhereInput =>
  user.role === "CLIENT"
    ? { clientId: user.userId }
    : { freelancerId: user.userId };

const toConversationView = (
  conversation: ConversationWithDetails,
  viewerId: string,
  unreadCount: number,
) => {
  const other =
    conversation.clientId === viewerId
      ? conversation.freelancer
      : conversation.client;

  return {
    id: conversation.id,
    job: { id: conversation.job.id, title: conversation.job.title },
    otherUser: {
      id: other.id,
      name: other.name,
      imageUrl: other.imageUrl,
      role: other.role,
    },
    lastMessage:
      conversation.lastMessageBody !== null &&
      conversation.lastMessageSenderId !== null
        ? {
            body: conversation.lastMessageBody,
            senderId: conversation.lastMessageSenderId,
            createdAt: conversation.lastMessageAt,
          }
        : null,
    unreadCount,
    lastMessageAt: conversation.lastMessageAt,
  };
};

// One groupBy for a whole page of conversations, never one query per conversation.
const getUnreadCounts = async (
  viewerId: string,
  conversationIds: string[],
): Promise<Map<string, number>> => {
  if (conversationIds.length === 0) return new Map();

  const rows = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversationIds },
      senderId: { not: viewerId },
      readAt: null,
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.conversationId, row._count._all]));
};

const getParticipantConversation = async (
  conversationId: string,
  viewerId: string,
) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });
  if (!conversation) throw new ApiError(404, "Conversation not found");

  // Private messages: participants only, no admin bypass.
  if (
    conversation.clientId !== viewerId &&
    conversation.freelancerId !== viewerId
  ) {
    throw new ApiError(403, "You are not a participant in this conversation");
  }

  return conversation;
};

const assertAccountsActive = (conversation: ConversationWithDetails): void => {
  const { client, freelancer } = conversation;

  if (client.deletedAt || freelancer.deletedAt) {
    throw new ApiError(
      400,
      "This conversation is closed because one of the accounts was deleted",
    );
  }
  if (client.isSuspended || freelancer.isSuspended) {
    throw new ApiError(
      400,
      "This conversation is unavailable because one of the accounts is suspended",
    );
  }
};

const hasRelationship = async (
  jobId: string,
  clientId: string,
  freelancerId: string,
): Promise<boolean> => {
  const [application, invitation, contract] = await Promise.all([
    prisma.application.findUnique({
      where: { jobId_freelancerId: { jobId, freelancerId } },
      select: { id: true },
    }),
    prisma.invitation.findFirst({
      where: {
        jobId,
        clientId,
        freelancerId,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      select: { id: true },
    }),
    prisma.contract.findFirst({
      where: { jobId, clientId, freelancerId },
      select: { id: true },
    }),
  ]);

  return Boolean(application || invitation || contract);
};

export const getOrCreateConversation = async (
  viewer: JwtPayload,
  input: ICreateConversation,
) => {
  if (input.otherUserId === viewer.userId) {
    throw new ApiError(400, "You can't start a conversation with yourself");
  }

  // The server decides who is client and who is freelancer from the caller's role.
  const viewerIsClient = viewer.role === "CLIENT";
  const clientId = viewerIsClient ? viewer.userId : input.otherUserId;
  const freelancerId = viewerIsClient ? input.otherUserId : viewer.userId;

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { id: true, clientId: true },
  });
  if (!job) throw new ApiError(404, "Job not found");
  if (job.clientId !== clientId) {
    throw new ApiError(
      403,
      "This job doesn't belong to the client in this conversation",
    );
  }

  const other = await prisma.user.findFirst({
    where: {
      id: input.otherUserId,
      role: viewerIsClient ? "FREELANCER" : "CLIENT",
      deletedAt: null,
      isSuspended: false,
    },
    select: { id: true },
  });
  if (!other) throw new ApiError(404, "User not found");

  const uniqueKey = {
    clientId_freelancerId_jobId: { clientId, freelancerId, jobId: job.id },
  };

  const existing = await prisma.conversation.findUnique({
    where: uniqueKey,
    include: conversationInclude,
  });
  if (existing) {
    const unread = await getUnreadCounts(viewer.userId, [existing.id]);
    return {
      conversation: toConversationView(
        existing,
        viewer.userId,
        unread.get(existing.id) ?? 0,
      ),
      created: false,
    };
  }

  // The relationship is only needed to START a conversation; once it exists it stays usable.
  if (!(await hasRelationship(job.id, clientId, freelancerId))) {
    throw new ApiError(
      403,
      "You can only message someone you have an application, an invitation or a contract with on this job",
    );
  }

  let created = true;
  const conversation = await prisma.conversation
    .create({
      data: { jobId: job.id, clientId, freelancerId },
      include: conversationInclude,
    })
    .catch(async (error: unknown) => {
      // Both people opened the thread at the same moment: return the one that won.
      if (isUniqueViolation(error)) {
        const raced = await prisma.conversation.findUnique({
          where: uniqueKey,
          include: conversationInclude,
        });
        if (raced) {
          created = false;
          return raced;
        }
      }
      throw error;
    });

  return {
    conversation: toConversationView(conversation, viewer.userId, 0),
    created,
  };
};

export const listMyConversations = async (
  viewer: JwtPayload,
  query: IConversationListQuery,
) => {
  const { skip, take, page, limit } = getPagination(query);
  // Conversations nobody has written in yet stay out of the inbox.
  const where: Prisma.ConversationWhereInput = {
    ...participantFilter(viewer),
    messages: { some: {} },
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: "desc" }, { id: "asc" }],
      skip,
      take,
      include: conversationInclude,
    }),
    prisma.conversation.count({ where }),
  ]);

  const unread = await getUnreadCounts(
    viewer.userId,
    conversations.map((conversation) => conversation.id),
  );

  return {
    conversations: conversations.map((conversation) =>
      toConversationView(
        conversation,
        viewer.userId,
        unread.get(conversation.id) ?? 0,
      ),
    ),
    meta: buildMeta(total, page, limit),
  };
};

/**
 * Cursor pagination over (createdAt, id).
 * - no cursor: the latest `limit` messages
 * - before:    the `limit` messages just older than the cursor
 * - after:     up to `limit` messages newer than the cursor (cheap polling)
 * Always returned oldest first. hasMore means "more exist in the direction you asked for".
 */
export const listMessages = async (
  conversationId: string,
  viewer: JwtPayload,
  query: IMessageListQuery,
) => {
  await getParticipantConversation(conversationId, viewer.userId);

  const cursorId = query.before ?? query.after;
  let cursor: { id: string; createdAt: Date } | null = null;

  if (cursorId) {
    // Scoped to this conversation, so a message id from another thread is rejected.
    cursor = await prisma.message.findFirst({
      where: { id: cursorId, conversationId },
      select: { id: true, createdAt: true },
    });
    if (!cursor) throw new ApiError(400, "Invalid cursor");
  }

  if (query.after && cursor) {
    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.limit + 1,
      select: messageSelect,
    });

    return {
      messages: rows.slice(0, query.limit),
      hasMore: rows.length > query.limit,
    };
  }

  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursor && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select: messageSelect,
  });

  return {
    messages: rows.slice(0, query.limit).reverse(),
    hasMore: rows.length > query.limit,
  };
};

export const sendMessage = async (
  conversationId: string,
  viewer: JwtPayload,
  rawBody: string,
) => {
  const conversation = await getParticipantConversation(
    conversationId,
    viewer.userId,
  );
  assertAccountsActive(conversation);

  const body = rawBody.trim();
  if (!body) throw new ApiError(400, "Message can't be empty");

  // One timestamp for both writes, so lastMessage.createdAt matches the real message.
  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: viewer.userId, body, createdAt: now },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        lastMessageBody: body,
        lastMessageSenderId: viewer.userId,
      },
    }),
  ]);

  const viewerIsClient = conversation.clientId === viewer.userId;
  const sender = viewerIsClient ? conversation.client : conversation.freelancer;
  const recipient = viewerIsClient
    ? conversation.freelancer
    : conversation.client;

  // Collapse: one unread NEW_MESSAGE per conversation is enough.
  const alreadyNotified = await prisma.notification.findFirst({
    where: {
      userId: recipient.id,
      type: "NEW_MESSAGE",
      entityType: "CONVERSATION",
      entityId: conversationId,
      isRead: false,
    },
    select: { id: true },
  });

  if (!alreadyNotified) {
    await notifyUser({
      userId: recipient.id,
      type: "NEW_MESSAGE",
      title: "New message",
      message: `${sender.name} sent you a message about "${conversation.job.title}"`,
      link: `/messages/${conversationId}`,
      entityType: "CONVERSATION",
      entityId: conversationId,
      meta: { jobId: conversation.job.id, conversationId },
    });
  }

  return message;
};

export const markConversationRead = async (
  conversationId: string,
  viewer: JwtPayload,
) => {
  await getParticipantConversation(conversationId, viewer.userId);

  const [messages] = await prisma.$transaction([
    prisma.message.updateMany({
      where: { conversationId, senderId: { not: viewer.userId }, readAt: null },
      data: { readAt: new Date() },
    }),
    // Without this, a stale unread NEW_MESSAGE notification would block all future ones.
    prisma.notification.updateMany({
      where: {
        userId: viewer.userId,
        type: "NEW_MESSAGE",
        entityType: "CONVERSATION",
        entityId: conversationId,
        isRead: false,
      },
      data: { isRead: true },
    }),
  ]);

  return { updatedCount: messages.count };
};

export const getUnreadMessageCount = async (viewer: JwtPayload) => {
  const unreadCount = await prisma.message.count({
    where: {
      senderId: { not: viewer.userId },
      readAt: null,
      conversation: participantFilter(viewer),
    },
  });

  return { unreadCount };
};
