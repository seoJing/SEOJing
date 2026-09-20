import daangnFrontendInternSnapshot from "../../../content-snapshots/career/daangn-frontend-intern.json";

import type {
  CareerOpportunity,
  CareerOpportunitySnapshot,
  CareerRecruitment,
  CareerSource,
} from "./types";

const snapshots = [
  validateCareerSnapshot(daangnFrontendInternSnapshot),
] as const;

export function listCareerOpportunities(
  now: Date = new Date(),
): CareerOpportunity[] {
  return snapshots
    .map((snapshot) => deriveCareerStatus(snapshot.opportunity, now))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCareerOpportunity(
  slug: string,
  now: Date = new Date(),
): CareerOpportunity | null {
  const opportunity = snapshots.find(
    (snapshot) => snapshot.opportunity.slug === slug,
  )?.opportunity;
  return opportunity ? deriveCareerStatus(opportunity, now) : null;
}

export function deriveCareerStatus(
  opportunity: CareerOpportunity,
  now: Date,
): CareerOpportunity {
  if (opportunity.recruitmentStatus !== "OPEN") return opportunity;
  const closingDates = opportunity.recruitments.map(
    (recruitment) => recruitment.closeDate,
  );
  const closingTimes = closingDates
    .filter((date): date is string => Boolean(date))
    .map((date) => Date.parse(`${date}T23:59:59+09:00`));
  if (closingTimes.some((time) => time >= now.getTime())) return opportunity;
  if (closingDates.some((date) => !date) || closingTimes.length === 0) {
    return { ...opportunity, recruitmentStatus: "UNKNOWN" };
  }
  return { ...opportunity, recruitmentStatus: "CLOSED" };
}

export function validateCareerSnapshot(
  value: unknown,
): CareerOpportunitySnapshot {
  const snapshot = record(value, "snapshot");
  if (snapshot.version !== 1) {
    throw new Error("Career snapshot version must be 1.");
  }
  requiredDate(snapshot.generatedAt, "snapshot.generatedAt");

  const opportunity = record(snapshot.opportunity, "snapshot.opportunity");
  requiredString(opportunity.slug, "opportunity.slug");
  requiredString(opportunity.title, "opportunity.title");
  enumValue(opportunity.role, ["FRONTEND"], "opportunity.role");
  enumValue(
    opportunity.category,
    ["INTERNSHIP", "NEW_GRAD", "PROGRAM"],
    "opportunity.category",
  );
  enumValue(
    opportunity.recruitmentStatus,
    ["OPEN", "CLOSED", "UPCOMING", "UNKNOWN"],
    "opportunity.recruitmentStatus",
  );
  requiredDate(opportunity.updatedAt, "opportunity.updatedAt");

  const company = record(opportunity.company, "opportunity.company");
  requiredString(company.slug, "company.slug");
  requiredString(company.name, "company.name");
  optionalString(company.englishName, "company.englishName");
  optionalHttpUrl(company.careersUrl, "company.careersUrl");

  if (!Array.isArray(opportunity.recruitments)) {
    throw new Error("opportunity.recruitments must be an array.");
  }
  opportunity.recruitments.forEach(validateRecruitment);

  if (!Array.isArray(opportunity.preparationNotes)) {
    throw new Error("opportunity.preparationNotes must be an array.");
  }
  opportunity.preparationNotes.forEach((note, index) =>
    requiredString(note, `preparationNotes[${index}]`),
  );

  if (opportunity.forecast !== null) {
    const forecast = record(opportunity.forecast, "opportunity.forecast");
    enumValue(
      forecast.confidence,
      ["LOW", "MEDIUM", "HIGH"],
      "forecast.confidence",
    );
    optionalDate(forecast.expectedOpenFrom, "forecast.expectedOpenFrom");
    optionalDate(forecast.expectedOpenTo, "forecast.expectedOpenTo");
    requiredDate(forecast.analyzedAt, "forecast.analyzedAt");
    requiredString(forecast.methodVersion, "forecast.methodVersion");
    if (!Array.isArray(forecast.reasons) || forecast.reasons.length === 0) {
      throw new Error("forecast.reasons must contain evidence.");
    }
    forecast.reasons.forEach((reason, index) =>
      requiredString(reason, `forecast.reasons[${index}]`),
    );
    if (
      !Number.isInteger(forecast.basedOnRecruitmentCount) ||
      (forecast.basedOnRecruitmentCount as number) < 1
    ) {
      throw new Error("forecast requires at least one recruitment record.");
    }
  }

  return value as CareerOpportunitySnapshot;
}

function validateRecruitment(value: unknown, index: number): void {
  const recruitment = record(value, `recruitments[${index}]`);
  requiredUuid(recruitment.id, `recruitments[${index}].id`);
  requiredString(recruitment.title, `recruitments[${index}].title`);
  if (!Number.isInteger(recruitment.year)) {
    throw new Error(`recruitments[${index}].year must be an integer.`);
  }
  optionalDate(recruitment.openDate, `recruitments[${index}].openDate`);
  optionalDate(recruitment.closeDate, `recruitments[${index}].closeDate`);
  if (recruitment.employmentType !== undefined) {
    enumValue(
      recruitment.employmentType,
      ["INTERNSHIP", "FULL_TIME", "CONTRACT", "PART_TIME", "OTHER"],
      `recruitments[${index}].employmentType`,
    );
  }
  if (!Array.isArray(recruitment.eligibility)) {
    throw new Error(`recruitments[${index}].eligibility must be an array.`);
  }
  recruitment.eligibility.forEach((item, itemIndex) =>
    requiredString(item, `recruitments[${index}].eligibility[${itemIndex}]`),
  );
  if (!Array.isArray(recruitment.process)) {
    throw new Error(`recruitments[${index}].process must be an array.`);
  }
  recruitment.process.forEach((item, itemIndex) => {
    const step = record(item, `recruitments[${index}].process[${itemIndex}]`);
    if (!Number.isInteger(step.order) || (step.order as number) < 1) {
      throw new Error(
        `recruitments[${index}].process[${itemIndex}].order must be a positive integer.`,
      );
    }
    enumValue(
      step.type,
      ["DOCUMENT", "CODING_TEST", "ASSIGNMENT", "INTERVIEW", "FINAL"],
      `recruitments[${index}].process[${itemIndex}].type`,
    );
    requiredString(
      step.label,
      `recruitments[${index}].process[${itemIndex}].label`,
    );
  });
  if (!Array.isArray(recruitment.sources) || recruitment.sources.length === 0) {
    throw new Error(`recruitments[${index}] requires at least one source.`);
  }
  recruitment.sources.forEach((source, sourceIndex) =>
    validateSource(source, index, sourceIndex),
  );
  if (
    !recruitment.sources.some(
      (source) => record(source, "source").type === "OFFICIAL",
    )
  ) {
    throw new Error(
      `recruitments[${index}] requires at least one OFFICIAL source.`,
    );
  }
}

function validateSource(
  value: unknown,
  recruitmentIndex: number,
  sourceIndex: number,
): void {
  const prefix = `recruitments[${recruitmentIndex}].sources[${sourceIndex}]`;
  const source = record(value, prefix) as CareerSource &
    Record<string, unknown>;
  requiredUuid(source.id, `${prefix}.id`);
  requiredString(source.title, `${prefix}.title`);
  enumValue(
    source.type,
    ["OFFICIAL", "BLOG", "COMMUNITY", "NEWS", "OTHER"],
    `${prefix}.type`,
  );
  requiredHttpUrl(source.url, `${prefix}.url`);
  optionalString(source.publisher, `${prefix}.publisher`);
  optionalDate(source.publishedAt, `${prefix}.publishedAt`);
  requiredDate(source.accessedAt, `${prefix}.accessedAt`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function requiredUuid(value: unknown, label: string): void {
  requiredString(value, label);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`${label} must be a UUID.`);
  }
}

function optionalString(value: unknown, label: string): void {
  if (value === undefined || value === null) return;
  requiredString(value, label);
}

function enumValue(
  value: unknown,
  allowed: readonly string[],
  label: string,
): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

function requiredDate(value: unknown, label: string): void {
  requiredString(value, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO date.`);
  }
}

function optionalDate(value: unknown, label: string): void {
  if (value === null || value === undefined) return;
  requiredDate(value, label);
}

function requiredHttpUrl(value: unknown, label: string): void {
  requiredString(value, label);
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(`${label} must use HTTP(S).`);
  }
}

function optionalHttpUrl(value: unknown, label: string): void {
  if (value === undefined || value === null || value === "") return;
  requiredHttpUrl(value, label);
}

export type { CareerOpportunity, CareerOpportunitySnapshot, CareerRecruitment };
