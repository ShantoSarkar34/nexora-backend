import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as conversationService from "./conversation.service";
import {
  listConversationsSchema,
  listMessagesSchema,
} from "./conversation.validation";

export const getOrCreateConversation = catchAsync(
  async (req: Request, res: Response) => {
    const { conversation, created } =
      await conversationService.getOrCreateConversation(req.user!, req.body);
    sendResponse(res, created ? 201 : 200, {
      success: true,
      message: created ? "Conversation created" : "Conversation fetched",
      data: conversation,
    });
  },
);

export const listMyConversations = catchAsync(
  async (req: Request, res: Response) => {
    // Parsed here so the service gets typed values (and blank params are ignored).
    const { query } = listConversationsSchema.parse({ query: req.query });
    const { conversations, meta } =
      await conversationService.listMyConversations(req.user!, query);
    sendResponse(res, 200, {
      success: true,
      message: "Conversations fetched",
      data: conversations,
      meta,
    });
  },
);

export const listMessages = catchAsync(async (req: Request, res: Response) => {
  const { query } = listMessagesSchema.parse({ query: req.query });
  const { messages, hasMore } = await conversationService.listMessages(
    getParam(req, "conversationId"),
    req.user!,
    query,
  );
  sendResponse(res, 200, {
    success: true,
    message: "Messages fetched",
    data: messages,
    meta: { hasMore },
  });
});

export const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const message = await conversationService.sendMessage(
    getParam(req, "conversationId"),
    req.user!,
    req.body.body,
  );
  sendResponse(res, 201, {
    success: true,
    message: "Message sent",
    data: message,
  });
});

export const markConversationRead = catchAsync(
  async (req: Request, res: Response) => {
    const result = await conversationService.markConversationRead(
      getParam(req, "conversationId"),
      req.user!,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Conversation marked as read",
      data: result,
    });
  },
);

export const getUnreadMessageCount = catchAsync(
  async (req: Request, res: Response) => {
    const result = await conversationService.getUnreadMessageCount(req.user!);
    sendResponse(res, 200, {
      success: true,
      message: "Unread count fetched",
      data: result,
    });
  },
);
