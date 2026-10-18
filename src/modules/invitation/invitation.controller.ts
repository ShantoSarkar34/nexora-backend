import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { getParam } from "../../utils/getParam";
import * as invitationService from "./invitation.service";
import {
  listMyInvitationsSchema,
  listSentInvitationsSchema,
} from "./invitation.validation";

export const createInvitation = catchAsync(
  async (req: Request, res: Response) => {
    const invitation = await invitationService.createInvitation(
      req.user!,
      req.body,
    );
    sendResponse(res, 201, {
      success: true,
      message: "Invitation sent",
      data: invitation,
    });
  },
);

export const listMyInvitations = catchAsync(
  async (req: Request, res: Response) => {
    // Parsed here so the service gets typed values (and blank params are ignored).
    const { query } = listMyInvitationsSchema.parse({ query: req.query });
    const { invitations, meta } = await invitationService.listMyInvitations(
      req.user!.userId,
      query,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Invitations fetched",
      data: invitations,
      meta,
    });
  },
);

export const listSentInvitations = catchAsync(
  async (req: Request, res: Response) => {
    const { query } = listSentInvitationsSchema.parse({ query: req.query });
    const { invitations, meta } = await invitationService.listSentInvitations(
      req.user!.userId,
      query,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Sent invitations fetched",
      data: invitations,
      meta,
    });
  },
);

export const respondToInvitation = catchAsync(
  async (req: Request, res: Response) => {
    const invitation = await invitationService.respondToInvitation(
      getParam(req, "invitationId"),
      req.user!,
      req.body.status,
    );
    sendResponse(res, 200, {
      success: true,
      message:
        invitation.status === "ACCEPTED"
          ? "Invitation accepted"
          : "Invitation declined",
      data: invitation,
    });
  },
);

export const cancelInvitation = catchAsync(
  async (req: Request, res: Response) => {
    const invitation = await invitationService.cancelInvitation(
      getParam(req, "invitationId"),
      req.user!,
    );
    sendResponse(res, 200, {
      success: true,
      message: "Invitation cancelled",
      data: invitation,
    });
  },
);
