import {
  JobCategory,
  BudgetType,
  ExperienceLevel,
  JobStatus,
} from "../../../generated/prisma/client";

export interface ICreateJob {
  title: string;
  description: string;
  category: JobCategory;
  budgetType: BudgetType;
  budgetMin: number;
  budgetMax: number;
  experienceLevel: ExperienceLevel;
  deadline?: Date;
  skills: string[];
}

export interface IUpdateJob {
  title?: string;
  description?: string;
  category?: JobCategory;
  budgetType?: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  experienceLevel?: ExperienceLevel;
  deadline?: Date;
  skills?: string[];
}

export interface IJobListQuery {
  search?: string;
  category?: JobCategory;
  budgetType?: BudgetType;
  experienceLevel?: ExperienceLevel;
  minBudget?: number;
  maxBudget?: number;
  sortBy?: "newest" | "budget_asc" | "budget_desc";
  page?: string;
  limit?: string;
}

export { JobStatus };
