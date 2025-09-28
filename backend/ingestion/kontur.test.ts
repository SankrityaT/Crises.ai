import { describe, expect, it } from "vitest";

import { normalizeFeature, normalizeSeverity } from "./kontur";

const feature = {
  id: "kontur_test",
  properties: {
    title: "Test Event",
    description: "Testing",
    severity: "high",
    updated: "2025-09-28T02:00:00.000Z",
  },
  geometry: {
    type: "Point",
    coordinates: [-89.65, 39.78] as [number, number],
  },
};

describe("Kontur normalization", () => {
  it("maps severity strings to normalized levels", () => {
    expect(normalizeSeverity("critical")).toBe("critical");
    expect(normalizeSeverity("HIGH")).toBe("high");
    expect(normalizeSeverity("unknown")).toBe("moderate");
  });

  it("normalizes feature geometry into NormalizedEvent", () => {
    const normalized = normalizeFeature(feature);

    expect(normalized).not.toBeNull();
    expect(normalized).toMatchObject({
      id: "kontur_test",
      source: "kontur",
      severity: "high",
      coordinates: {
        latitude: 39.78,
        longitude: -89.65,
      },
    });
  });

  it("rejects features without coordinates", () => {
    const normalized = normalizeFeature({
      ...feature,
      geometry: undefined,
    });

    expect(normalized).toBeNull();
  });
});
