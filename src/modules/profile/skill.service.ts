import prisma from "../../config/prismaClient";

export const findOrCreateSkill = async (rawName: string) => {
  const name = rawName.trim();
  return prisma.skill.upsert({
    where: { name },
    update: {},
    create: { name },
  });
};
