import { describe, expect, it } from "vitest";

import {
  normalizeDisaster,
  buildRapidClusters,
  severityFromDisaster,
} from "./fema";

const record = {
  id: "fema_test_1",
  disasterNumber: 9001,
  state: "CA",
  incidentType: "Fire",
  declarationType: "FM",
  declarationTitle: "Test Fire Declaration",
  designatedArea: "Los Angeles County",
  declarationDate: "2025-09-20T12:00:00.000Z",
  incidentBeginDate: "2025-09-19T18:00:00.000Z",
  lastRefresh: "2025-09-20T13:30:00.000Z",
};

describe("FEMA ingestion", () => {
  it("derives severity buckets from incident type", () => {
    expect(severityFromDisaster({ ...record, incidentType: "Hurricane" })).toBe(
      "critical"
    );
    expect(severityFromDisaster({ ...record, incidentType: "Fire" })).toBe("high");
    expect(severityFromDisaster({ ...record, incidentType: "Flood" })).toBe(
      "moderate"
    );
    expect(severityFromDisaster({ ...record, incidentType: "Drought" })).toBe(
      "low"
    );
  });

  it("normalizes FEMA disasters into events with state centroids", () => {
    const event = normalizeDisaster(record);

    expect(event).toMatchObject({
      id: "fema_fema_test_1",
      source: "fema",
      coordinates: {
        latitude: 36.116203,
        longitude: -119.681564,
      },
      severity: "high",
    });
  });

  it("aggregates disasters into rapid call clusters by state + type", () => {
    const clusters = buildRapidClusters([
      record,
      { ...record, id: "fema_test_2", incidentType: "Fire" },
      { ...record, id: "fema_test_3", incidentType: "Flood" },
      { ...record, id: "fema_test_4", state: "FL", incidentType: "Fire" },
    ]);

    const fireCluster = clusters.find(
      (cluster) => cluster.id === "CA_Fire"
    );
    expect(fireCluster?.volume).toBe(2);

    const floodCluster = clusters.find(
      (cluster) => cluster.id === "CA_Flood"
    );
    expect(floodCluster?.volume).toBe(1);

    const floridaCluster = clusters.find(
      (cluster) => cluster.id === "FL_Fire"
    );
    expect(floridaCluster?.coordinates.lat).toBeCloseTo(27.766279, 3);
  });
});
