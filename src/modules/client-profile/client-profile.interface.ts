export interface ICreateClientProfile {
  companyName?: string;
  industry?: string;
  companySize?: "SOLO" | "SMALL" | "MEDIUM" | "LARGE";
  website?: string;
  about?: string;
}

export type IUpdateClientProfile = ICreateClientProfile;
