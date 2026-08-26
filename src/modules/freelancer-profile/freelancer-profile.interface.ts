export interface ICreateFreelancerProfile {
  title?: string;
  bio?: string;
  hourlyRate?: number;
  experienceLevel?: "ENTRY" | "INTERMEDIATE" | "EXPERT";
  availability?: "AVAILABLE" | "BUSY" | "NOT_AVAILABLE";
}

export type IUpdateFreelancerProfile = ICreateFreelancerProfile;

export interface IAddExperience {
  title: string;
  company: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  description?: string;
}

export interface IAddPortfolio {
  title: string;
  description?: string;
  projectUrl?: string;
  imageUrl?: string;
}
