import { describe, expect, it } from "vitest";

import { normalizeFeature, severityFromMagnitude } from "./usgs";

const baseFeature = {
  id: "test",
  properties: {
    mag: 4.2,
    place: "10km S of Testville",
    time: 1_700_000_000_000,
    title: "M 4.2 - 10km S of Testville",
  },
  geometry: {
    coordinates: [-122.4, 37.7, 8] as [number, number, number],
  },
};

describe("USGS normalization", () => {
  it("normalizes a valid feature into the shared schema", () => {
    const normalized = normalizeFeature(baseFeature);

    expect(normalized).not.toBeNull();
    expect(normalized).toMatchObject({
      id: "test",
      source: "usgs",
      title: "M 4.2 - 10km S of Testville",
      coordinates: {
        latitude: 37.7,
        longitude: -122.4,
        depth: 8,
      },
      magnitude: 4.2,
    });
  });

  it("drops features without geometry coordinates", () => {
    const normalized = normalizeFeature({
      ...baseFeature,
      id: "missing_geo",
      geometry: undefined,
    });

    expect(normalized).toBeNull();
  });

  it("derives severity from magnitude heuristics", () => {
    expect(severityFromMagnitude(6.8)).toBe("critical");
    expect(severityFromMagnitude(5.5)).toBe("high");
    expect(severityFromMagnitude(3.8)).toBe("moderate");
    expect(severityFromMagnitude(1.3)).toBe("low");
    expect(severityFromMagnitude(undefined)).toBe("moderate");
  });
});
