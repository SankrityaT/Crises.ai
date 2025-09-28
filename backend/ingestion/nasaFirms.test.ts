import { describe, expect, it } from "vitest";

import { deriveSeverity, normalizeFire, NasaFireRecord } from "./nasaFirms";

describe("NASA FIRMS normalization", () => {
  const baseFire: NasaFireRecord = {
    id: "fire_1",
    brightness: 320,
    latitude: 34,
    longitude: -118,
    acq_date: "2025-09-28",
    acq_time: "0210",
    confidence: "high",
  };

  it("maps brightness to severity bands", () => {
    expect(deriveSeverity({ ...baseFire, brightness: 360 })).toBe("critical");
    expect(deriveSeverity({ ...baseFire, brightness: 315 })).toBe("high");
    expect(deriveSeverity({ ...baseFire, brightness: 285 })).toBe("moderate");
    expect(deriveSeverity({ ...baseFire, brightness: 250 })).toBe("low");
  });

  it("normalizes fire record to normalized event", () => {
    const normalized = normalizeFire(baseFire);

    expect(normalized).toMatchObject({
      id: "fire_1",
      source: "nasa",
      magnitude: 320,
      severity: "high",
    });
    expect(new Date(normalized.occurredAt).toISOString()).toBe(normalized.occurredAt);
  });
});
