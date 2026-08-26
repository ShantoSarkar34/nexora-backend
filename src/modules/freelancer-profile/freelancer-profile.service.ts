import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { checkOwnership } from "../../utils/checkOwnership";
import { JwtPayload } from "../../utils/jwt";
import { findOrCreateSkill } from "../skill/skill.service";
import {
  ICreateFreelancerProfile,
  IUpdateFreelancerProfile,
  IAddExperience,
  IAddPortfolio,
} from "./freelancer-profile.interface";

const includeFullProfile = {
  skills: { include: { skill: true } },
  experiences: true,
  portfolios: true,
};

const calculateCompletion = (profile: any): number => {
  const checks = [
    !!profile.title,
    !!profile.bio,
    !!profile.hourlyRate,
    !!profile.experienceLevel,
    profile.skills.length > 0,
    profile.experiences.length > 0,
    profile.portfolios.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

export const createFreelancerProfile = async (
  userId: string,
  data: ICreateFreelancerProfile
) => {
  const existing = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (existing) throw new ApiError(409, "Freelancer profile already exists");
  return prisma.freelancerProfile.create({ data: { userId, ...data } });
};

export const getMyFreelancerProfile = async (userId: string) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
    include: includeFullProfile,
  });
  if (!profile)
    throw new ApiError(404, "Freelancer profile not found. Create one first.");
  return { ...profile, completionPercentage: calculateCompletion(profile) };
};

export const updateFreelancerProfile = async (
  userId: string,
  currentUser: JwtPayload,
  data: IUpdateFreelancerProfile
) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  checkOwnership(profile.userId, currentUser);
  return prisma.freelancerProfile.update({ where: { userId }, data });
};

export const addSkill = async (userId: string, skillName: string) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");

  const skill = await findOrCreateSkill(skillName);
  const existingLink = await prisma.freelancerSkill.findUnique({
    where: {
      freelancerProfileId_skillId: {
        freelancerProfileId: profile.id,
        skillId: skill.id,
      },
    },
  });
  if (existingLink) throw new ApiError(409, "Skill already added");

  return prisma.freelancerSkill.create({
    data: { freelancerProfileId: profile.id, skillId: skill.id },
    include: { skill: true },
  });
};

export const removeSkill = async (
  userId: string,
  skillId: string,
  currentUser: JwtPayload
) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  checkOwnership(profile.userId, currentUser);
  await prisma.freelancerSkill.delete({
    where: {
      freelancerProfileId_skillId: { freelancerProfileId: profile.id, skillId },
    },
  });
};

export const addExperience = async (userId: string, data: IAddExperience) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  return prisma.experience.create({
    data: { freelancerProfileId: profile.id, ...data },
  });
};

export const deleteExperience = async (
  experienceId: string,
  currentUser: JwtPayload
) => {
  const experience = await prisma.experience.findUnique({
    where: { id: experienceId },
    include: { freelancerProfile: true },
  });
  if (!experience) throw new ApiError(404, "Experience not found");
  checkOwnership(experience.freelancerProfile.userId, currentUser);
  await prisma.experience.delete({ where: { id: experienceId } });
};

export const addPortfolio = async (userId: string, data: IAddPortfolio) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  return prisma.portfolio.create({
    data: { freelancerProfileId: profile.id, ...data },
  });
};

export const deletePortfolio = async (
  portfolioId: string,
  currentUser: JwtPayload
) => {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { freelancerProfile: true },
  });
  if (!portfolio) throw new ApiError(404, "Portfolio item not found");
  checkOwnership(portfolio.freelancerProfile.userId, currentUser);
  await prisma.portfolio.delete({ where: { id: portfolioId } });
};

export const getPublicFreelancerProfile = async (userId: string) => {
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId },
    include: {
      ...includeFullProfile,
      user: { select: { name: true, createdAt: true } },
    },
  });
  if (!profile) throw new ApiError(404, "Freelancer profile not found");
  return profile;
};
