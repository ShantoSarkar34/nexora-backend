import { IRuleBasedMatchResult } from "./ai-match.interface";

interface JobForMatching {
  experienceLevel: string;
  skills: { skill: { name: string } }[];
}

interface FreelancerForMatching {
  experienceLevel: string | null;
  skills: { skill: { name: string } }[];
  portfolios: unknown[];
}

const EXPERIENCE_ORDER = ["ENTRY", "INTERMEDIATE", "EXPERT"];

export const calculateRuleBasedMatch = (
  job: JobForMatching,
  freelancer: FreelancerForMatching
): IRuleBasedMatchResult => {
  const jobSkillNames = job.skills.map((s) => s.skill.name.toLowerCase());
  const freelancerSkillNames = new Set(
    freelancer.skills.map((s) => s.skill.name.toLowerCase())
  );

  const matchedSkills = jobSkillNames.filter((name) =>
    freelancerSkillNames.has(name)
  );
  const missingSkills = jobSkillNames.filter(
    (name) => !freelancerSkillNames.has(name)
  );
  const skillMatchPercentage =
    jobSkillNames.length > 0
      ? Math.round((matchedSkills.length / jobSkillNames.length) * 100)
      : 0;

  const jobLevelIndex = EXPERIENCE_ORDER.indexOf(job.experienceLevel);
  const freelancerLevelIndex = freelancer.experienceLevel
    ? EXPERIENCE_ORDER.indexOf(freelancer.experienceLevel)
    : -1;
  // Exact match, or freelancer is MORE experienced than required — both count as a match.
  const experienceLevelMatch =
    freelancerLevelIndex !== -1 && freelancerLevelIndex >= jobLevelIndex;

  const hasRelevantPortfolio = freelancer.portfolios.length > 0;

  // Weighted: skills matter most, experience level second, portfolio a small bonus.
  const matchScore = Math.round(
    skillMatchPercentage * 0.6 +
      (experienceLevelMatch ? 100 : 0) * 0.25 +
      (hasRelevantPortfolio ? 100 : 0) * 0.15
  );

  return {
    matchScore,
    breakdown: {
      skillMatchPercentage,
      matchedSkills,
      missingSkills,
      experienceLevelMatch,
      hasRelevantPortfolio,
    },
  };
};
