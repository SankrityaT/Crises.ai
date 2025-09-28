import { beforeEach, describe, expect, it } from "vitest";

import { enrichEventWithRisk, invalidateCustomerDensityCache } from "./riskScore";

const baseEvent = {
  id: "event-1",
  title: "Mock earthquake",
  source: "usgs" as const,
  coordinates: {
    latitude: 41.88,
    longitude: -87.63,
    depth: 10,
  },
  magnitude: 6.5,
  occurredAt: new Date().toISOString(),
  raw: {},
};

beforeEach(() => {
  delete process.env.DATABASE_URL;
  invalidateCustomerDensityCache();
});

describe("risk scoring", () => {
  it("assigns a critical risk score inside a dense region", async () => {
    const enriched = await enrichEventWithRisk(baseEvent);

    expect(enriched.customerDensityId).toBe("chi_downtown");
    expect(enriched.riskScore).toBeGreaterThan(75);
    expect(enriched.severity).toBe("critical");
  });

  it("downgrades risk for low magnitude events outside of density polygons", async () => {
    const enriched = await enrichEventWithRisk({
      ...baseEvent,
      id: "event-2",
      coordinates: { latitude: 35.0, longitude: -100.0 },
      magnitude: 2.1,
    });

    expect(enriched.customerDensityId).toBeNull();
    expect(enriched.riskScore ?? 0).toBeLessThan(40);
    expect(enriched.severity).toBe("low");
  });
});
