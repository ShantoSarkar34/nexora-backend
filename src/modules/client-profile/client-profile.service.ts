import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import {
  ICreateClientProfile,
  IUpdateClientProfile,
} from "./client-profile.interface";

export const createClientProfile = async (
  userId: string,
  data: ICreateClientProfile
) => {
  const existing = await prisma.clientProfile.findUnique({ where: { userId } });
  if (existing) throw new ApiError(409, "Client profile already exists");
  return prisma.clientProfile.create({ data: { userId, ...data } });
};

export const getMyClientProfile = async (userId: string) => {
  const profile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!profile)
    throw new ApiError(404, "Client profile not found. Create one first.");
  return profile;
};

export const updateClientProfile = async (
  userId: string,
  currentUser: JwtPayload,
  data: IUpdateClientProfile
) => {
  const profile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError(404, "Client profile not found");
  checkOwnership(profile.userId, currentUser);
  return prisma.clientProfile.update({ where: { userId }, data });
};

export const getPublicClientProfile = async (userId: string) => {
  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, createdAt: true } } },
  });
  if (!profile) throw new ApiError(404, "Client profile not found");
  return profile;
};
