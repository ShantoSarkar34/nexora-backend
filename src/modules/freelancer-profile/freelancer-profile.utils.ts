interface CompletionInput {
  title: string | null;
  bio: string | null;
  hourlyRate: unknown;
  experienceLevel: string | null;
  skillCount: number;
  experienceCount: number;
  portfolioCount: number;
}

export const calculateProfileCompletion = (input: CompletionInput): number => {
  const checks = [
    !!input.title,
    !!input.bio,
    input.hourlyRate !== null && input.hourlyRate !== undefined,
    !!input.experienceLevel,
    input.skillCount > 0,
    input.experienceCount > 0,
    input.portfolioCount > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};
