import { Availability, ExperienceLevel } from "../../../generated/prisma";

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

export type FreelancerSortBy = "newest" | "rate_asc" | "rate_desc" | "rating";


export interface IFreelancerListQuery {
  search?: string;
  skills?: string; 
  experienceLevel?: ExperienceLevel;
  availability?: Availability;
  minRate?: number;
  maxRate?: number;
  minRating?: number;
  sortBy: FreelancerSortBy;
  page?: string;
  limit?: string;
}

export interface IFreelancerListItem {
  userId: string;
  name: string;
  imageUrl: string | null;
  title: string | null;
  bio: string | null;
  hourlyRate: number | null;
  experienceLevel: ExperienceLevel | null;
  availability: Availability;
  skills: { id: string; name: string }[];
  averageRating: number;
  totalReviews: number;
  completionPercentage: number;
}
