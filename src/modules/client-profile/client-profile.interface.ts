export interface ICreateClientProfile {
  companyName?: string;
  industry?: string;
  companySize?: "SOLO" | "SMALL" | "MEDIUM" | "LARGE";
  website?: string;
  about?: string;
  location?: string;
  foundedYear?: number;
  linkedinUrl?: string;
  twitterUrl?: string;
}

export type IUpdateClientProfile = ICreateClientProfile;
