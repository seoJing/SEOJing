import { describe, expect, it } from "vitest";
import { formatDateOnly } from "./date";

describe("date-only ko-KR / Asia-Seoul contract", () => {
  it("preserves calendar dates and converts explicit instants at Seoul midnight", () => {
    expect(formatDateOnly("2024-02-29")).toBe("2024. 02. 29.");
    expect(formatDateOnly("2026-10-21T14:59:59Z")).toBe("2026. 10. 21.");
    expect(formatDateOnly("2026-10-21T15:00:00Z")).toBe("2026. 10. 22.");
    expect(formatDateOnly("2026-01-01T00:30:00+09:00")).toBe("2026. 01. 01.");
    expect(formatDateOnly(new Date("2025-12-31T15:30:00Z"))).toBe(
      "2026. 01. 01.",
    );
  });
  it("rejects invalid and host-timezone-dependent input", () => {
    for (const value of [
      "",
      "garbage",
      "2025-02-29",
      "2026-10-22T00:00:00",
      null,
      undefined,
      new Date(NaN),
    ])
      expect(formatDateOnly(value)).toBe("—");
  });
  it("has identical server/client output across host time zones", () => {
    const previous = process.env.TZ;
    try {
      for (const tz of [
        "UTC",
        "America/Los_Angeles",
        "Asia/Seoul",
        "Pacific/Kiritimati",
      ]) {
        process.env.TZ = tz;
        expect(formatDateOnly("2026-01-01")).toBe("2026. 01. 01.");
        expect(formatDateOnly("2025-12-31T23:59:59Z")).toBe("2026. 01. 01.");
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
