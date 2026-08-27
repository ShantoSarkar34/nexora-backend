export interface ICreateApplication {
  jobId: string;
  coverLetter: string;
  proposedBudget: number;
  estimatedDeliveryDays: number;
}

export interface IApplicationListQuery {
  status?: "PENDING" | "SHORTLISTED" | "REJECTED" | "HIRED" | "WITHDRAWN";
  page?: string;
  limit?: string;
}
