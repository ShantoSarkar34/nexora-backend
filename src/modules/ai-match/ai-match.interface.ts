export interface IRuleBasedMatchResult {
  matchScore: number;
  breakdown: {
    skillMatchPercentage: number;
    matchedSkills: string[];
    missingSkills: string[];
    experienceLevelMatch: boolean;
    hasRelevantPortfolio: boolean;
  };
}

export interface IAiMatchResult {
  matchScore: number;
  strengths: string[];
  missingSkills: string[];
  recommendation: string;
}
