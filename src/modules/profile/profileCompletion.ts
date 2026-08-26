// src/modules/profile/profileCompletion.ts
import {
  FreelancerProfile,
  FreelancerSkill,
  Experience,
  Portfolio,
} from "../../../prisma/generated/client";

type FullFreelancerProfile = FreelancerProfile & {
  skills: FreelancerSkill[];
  experiences: Experience[];
  portfolios: Portfolio[];
};

export const calculateFreelancerCompletion = (
  profile: FullFreelancerProfile
): number => {
  const checks = [
    !!profile.title,
    !!profile.bio,
    !!profile.hourlyRate,
    !!profile.experienceLevel,
    profile.skills.length > 0,
    profile.experiences.length > 0,
    profile.portfolios.length > 0,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
};
