export type CareerRole = "FRONTEND";
export type CareerOpportunityCategory = "INTERNSHIP" | "NEW_GRAD" | "PROGRAM";
export type CareerRecruitmentStatus =
  | "OPEN"
  | "CLOSED"
  | "UPCOMING"
  | "UNKNOWN";
export type CareerForecastConfidence = "LOW" | "MEDIUM" | "HIGH";
export type CareerSourceType =
  | "OFFICIAL"
  | "BLOG"
  | "COMMUNITY"
  | "NEWS"
  | "OTHER";

export interface CareerCompany {
  slug: string;
  name: string;
  englishName?: string;
  careersUrl?: string;
}

export interface CareerSource {
  id: string;
  type: CareerSourceType;
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string | null;
  accessedAt: string;
}

export interface CareerRecruitmentProcessStep {
  order: number;
  type: "DOCUMENT" | "CODING_TEST" | "ASSIGNMENT" | "INTERVIEW" | "FINAL";
  label: string;
}

export interface CareerRecruitment {
  id: string;
  year: number;
  title: string;
  openDate?: string | null;
  closeDate?: string | null;
  employmentType?:
    | "INTERNSHIP"
    | "FULL_TIME"
    | "CONTRACT"
    | "PART_TIME"
    | "OTHER";
  eligibility: string[];
  process: CareerRecruitmentProcessStep[];
  sources: CareerSource[];
}

export interface CareerForecast {
  expectedOpenFrom?: string | null;
  expectedOpenTo?: string | null;
  confidence: CareerForecastConfidence;
  reasons: string[];
  basedOnRecruitmentCount: number;
  methodVersion: string;
  analyzedAt: string;
}

export interface CareerOpportunity {
  slug: string;
  title: string;
  role: CareerRole;
  category: CareerOpportunityCategory;
  recruitmentStatus: CareerRecruitmentStatus;
  company: CareerCompany;
  forecast: CareerForecast | null;
  recruitments: CareerRecruitment[];
  preparationNotes: string[];
  updatedAt: string;
}

export interface CareerOpportunitySnapshot {
  version: 1;
  generatedAt: string;
  opportunity: CareerOpportunity;
}
