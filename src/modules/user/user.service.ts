import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { comparePassword } from "../../utils/hashPassword";
import { uploadToImgbb } from "../../utils/imgbb";
import { ContractStatus } from "../../../generated/prisma";
import { CURRENT_USER_SELECT } from "./user.constants";
import { IDeleteAccount } from "./user.interface";

const BLOCKING_CONTRACT_STATUSES: ContractStatus[] = ["PENDING", "ACTIVE", "SUBMITTED", "DISPUTED"];

export const uploadUserAvatar = async (userId: string, fileBuffer: Buffer) => {
  const imageUrl = await uploadToImgbb(fileBuffer);

  return prisma.user.update({
    where: { id: userId },
    data: { imageUrl },
    select: CURRENT_USER_SELECT,
  });
};

export const updateMyProfile = async (userId: string, name: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: { name: name.trim() },
    select: CURRENT_USER_SELECT,
  });
};

export const deleteMyAccount = async (userId: string, input: IDeleteAccount) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new ApiError(404, "User not found");
  }

  if (user.password) {
    if (!input.password) {
      throw new ApiError(400, "Password is required to delete your account");
    }
    if (!(await comparePassword(input.password, user.password))) {
      throw new ApiError(400, "Password is incorrect");
    }
  } else if (!input.confirmEmail || input.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    // Google-only account: no password exists, so the user retypes their email.
    throw new ApiError(400, "Please type your account email to confirm deletion");
  }

  const blockingContracts = await prisma.contract.count({
    where: {
      status: { in: BLOCKING_CONTRACT_STATUSES },
      OR: [{ clientId: userId }, { freelancerId: userId }],
    },
  });
  if (blockingContracts > 0) {
    throw new ApiError(409, "You have contracts in progress. Complete or cancel them before deleting your account.");
  }


  await prisma.$transaction([
    prisma.freelancerProfile.deleteMany({ where: { userId } }),
    prisma.clientProfile.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        email: `deleted+${userId}@nexora.invalid`,
        password: null,
        googleId: null,
        imageUrl: null,
        deletedAt: new Date(),
      },
    }),
  ]);
};