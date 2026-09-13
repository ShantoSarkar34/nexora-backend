import prisma from "../../config/prismaClient";
import { uploadToImgbb } from "../../utils/imgbb";

export const uploadUserAvatar = async (userId: string, fileBuffer: Buffer) => {
  const imageUrl = await uploadToImgbb(fileBuffer);

  return prisma.user.update({
    where: { id: userId },
    data: { imageUrl },
    select: { id: true, name: true, email: true, imageUrl: true },
  });
};
