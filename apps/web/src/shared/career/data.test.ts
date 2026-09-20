import { describe, expect, it } from "vitest";

import {
  deriveCareerStatus,
  getCareerOpportunity,
  listCareerOpportunities,
  validateCareerSnapshot,
} from "./data";

describe("career snapshot data", () => {
  it("loads the verified Daangn frontend internship snapshot", () => {
    const opportunity = getCareerOpportunity(
      "daangn-frontend-intern",
      new Date("2026-09-20T00:00:00+09:00"),
    );

    expect(opportunity).toMatchObject({
      recruitmentStatus: "OPEN",
      company: { name: "당근" },
      forecast: null,
    });
    expect(opportunity?.recruitments[0]?.sources[0]).toMatchObject({
      type: "OFFICIAL",
      url: "https://careers.daangn.com/jobs/role/7993811003/",
    });
    expect(
      listCareerOpportunities(new Date("2026-09-20T00:00:00+09:00")),
    ).toHaveLength(1);
  });

  it("does not keep a stale snapshot marked open after its verified deadline", () => {
    expect(
      getCareerOpportunity(
        "daangn-frontend-intern",
        new Date("2026-09-28T00:00:00+09:00"),
      )?.recruitmentStatus,
    ).toBe("CLOSED");
  });

  it("marks ambiguous OPEN data unknown when only expired and undated records remain", () => {
    const opportunity = getCareerOpportunity(
      "daangn-frontend-intern",
      new Date("2026-09-20T00:00:00+09:00"),
    );
    expect(opportunity).not.toBeNull();

    expect(
      deriveCareerStatus(
        {
          ...opportunity!,
          recruitments: [
            ...opportunity!.recruitments,
            {
              ...opportunity!.recruitments[0]!,
              id: "undated-history",
              closeDate: null,
            },
          ],
        },
        new Date("2026-09-28T00:00:00+09:00"),
      ).recruitmentStatus,
    ).toBe("UNKNOWN");
  });

  it("rejects forecasts without evidence", () => {
    expect(() =>
      validateCareerSnapshot({
        version: 1,
        generatedAt: "2026-09-20T00:00:00Z",
        opportunity: {
          slug: "invalid",
          title: "Invalid forecast",
          role: "FRONTEND",
          category: "INTERNSHIP",
          recruitmentStatus: "UNKNOWN",
          company: { slug: "test", name: "Test" },
          forecast: {
            expectedOpenFrom: null,
            expectedOpenTo: null,
            confidence: "MEDIUM",
            reasons: [],
            basedOnRecruitmentCount: 0,
            methodVersion: "v0",
            analyzedAt: "2026-09-20T00:00:00Z",
          },
          recruitments: [],
          preparationNotes: [],
          updatedAt: "2026-09-20T00:00:00Z",
        },
      }),
    ).toThrow("forecast.reasons");
  });

  it("rejects public recruitment facts without an official source", () => {
    const opportunity = getCareerOpportunity(
      "daangn-frontend-intern",
      new Date("2026-09-20T00:00:00+09:00"),
    );
    expect(opportunity).not.toBeNull();

    expect(() =>
      validateCareerSnapshot({
        version: 1,
        generatedAt: "2026-09-20T00:00:00Z",
        opportunity: {
          ...opportunity!,
          recruitments: opportunity!.recruitments.map((recruitment) => ({
            ...recruitment,
            sources: recruitment.sources.map((source) => ({
              ...source,
              type: "BLOG",
            })),
          })),
        },
      }),
    ).toThrow("OFFICIAL source");
  });

  it("rejects recruitment facts without a source", () => {
    expect(() =>
      validateCareerSnapshot({
        version: 1,
        generatedAt: "2026-09-20T00:00:00Z",
        opportunity: {
          slug: "invalid",
          title: "Unsourced",
          role: "FRONTEND",
          category: "INTERNSHIP",
          recruitmentStatus: "CLOSED",
          company: { slug: "test", name: "Test" },
          forecast: null,
          recruitments: [
            {
              id: "04de7617-01f5-4f50-90c6-a53128ae6d9b",
              year: 2026,
              title: "Missing source",
              openDate: null,
              closeDate: null,
              eligibility: [],
              process: [],
              sources: [],
            },
          ],
          preparationNotes: [],
          updatedAt: "2026-09-20T00:00:00Z",
        },
      }),
    ).toThrow("requires at least one source");
  });
});
