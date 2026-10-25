export interface IRecommendedJobsQuery {
  limit: number;
}

// What gets cached per freelancer: just the ranking, never the job data itself.
export interface IRecommendationCandidate {
  jobId: string;
  matchScore: number;
  matchedSkills: string[];
}

export type RecommendationEmptyReason =
  | "NO_PROFILE"
  | "NO_SKILLS"
  | "NO_MATCHES";
