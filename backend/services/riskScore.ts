import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDb, isDatabaseConfigured, schema } from "./db";
import { updateCustomerDensityCache } from "./stateCache";
import {
  NormalizedEvent,
  PersistedEvent,
  RiskFactorBreakdown,
  RiskScoreResult,
} from "../../types/events";

interface GeoPoint {
  latitude: number;
  longitude: number;
}

type GeoPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type GeoMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

type GeoGeometry = GeoPolygon | GeoMultiPolygon;

type CustomerDensityRow = typeof schema.customerDensity.$inferSelect;

interface CustomerDensityRegion {
  id: string;
  regionName: string;
  densityScore: number;
  population?: number;
  geometry: GeoGeometry;
}

let cachedRegions: CustomerDensityRegion[] | null = null;

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

function normalizeRegion(row: CustomerDensityRow): CustomerDensityRegion {
  return {
    id: row.id,
    regionName: row.regionName,
    densityScore: Number(row.densityScore ?? 0),
    population: row.population ?? undefined,
    geometry: row.geom as GeoGeometry,
  };
}

async function loadRegionsFromDatabase(): Promise<CustomerDensityRegion[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDb();
  const rows = await db.select().from(schema.customerDensity);
  const regions = rows.map(normalizeRegion);

  if (regions.length) {
    updateCustomerDensityCache(regions);
  }

  return regions;
}

async function loadRegionsFromMock(): Promise<CustomerDensityRegion[]> {
  const fileContent = await readFile(resolveMockPath("customer_density.geojson"), "utf-8");
  const json = JSON.parse(fileContent) as {
    features: Array<{
      id?: string;
      properties: {
        name: string;
        densityScore: number;
        population?: number;
      };
      geometry: GeoGeometry;
    }>;
  };

  return json.features.map((feature, index) => ({
    id: feature.id ?? `mock_density_${index}`,
    regionName: feature.properties.name,
    densityScore: feature.properties.densityScore,
    population: feature.properties.population ?? undefined,
    geometry: feature.geometry,
  }));
}

async function getCustomerDensityRegions(): Promise<CustomerDensityRegion[]> {
  if (cachedRegions) {
    return cachedRegions;
  }

  const regionsFromDb = await loadRegionsFromDatabase();

  if (regionsFromDb.length > 0) {
    cachedRegions = regionsFromDb;
    return cachedRegions;
  }

  cachedRegions = await loadRegionsFromMock();
  if (cachedRegions.length) {
    updateCustomerDensityCache(cachedRegions);
  }
  return cachedRegions;
}

function pointInPolygon(point: GeoPoint, polygon: GeoPolygon): boolean {
  const { latitude: y, longitude: x } = point;
  let inside = false;

  for (const ring of polygon.coordinates) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
      if (intersect) inside = !inside;
    }
  }

  return inside;
}

function pointInGeometry(point: GeoPoint, geometry: GeoGeometry): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry);
  }

  return geometry.coordinates.some((polygonCoordinates) =>
    pointInPolygon(point, { type: "Polygon", coordinates: polygonCoordinates })
  );
}

function deriveRegionForPoint(
  coordinates: GeoPoint,
  regions: CustomerDensityRegion[]
): CustomerDensityRegion | undefined {
  return regions.find((region) => pointInGeometry(coordinates, region.geometry));
}

function normalizeMagnitude(magnitude?: number | null): number {
  if (magnitude == null) {
    return 0.3;
  }

  const clamped = Math.max(0, Math.min(magnitude, 8));
  return clamped / 8;
}

function normalizeDensity(densityScore?: number): number {
  if (!densityScore || Number.isNaN(densityScore)) {
    return 0.2;
  }

  return Math.max(0, Math.min(densityScore, 1));
}

function normalizeRecency(occurredAt: string): number {
  const occurred = new Date(occurredAt);
  const hours = Math.abs(Date.now() - occurred.getTime()) / 3_600_000;
  if (!Number.isFinite(hours)) {
    return 0.5;
  }

  return Math.max(0, 1 - hours / 24);
}

function determineLevel(score: number): RiskScoreResult["level"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

function computeRiskScore(
  event: NormalizedEvent,
  region?: CustomerDensityRegion
): RiskScoreResult {
  const magnitudeWeight = normalizeMagnitude(event.magnitude ?? null);
  const densityWeight = normalizeDensity(region?.densityScore ?? undefined);
  const recencyWeight = normalizeRecency(event.occurredAt);

  const factors: RiskFactorBreakdown = {
    magnitudeWeight,
    densityWeight,
    recencyWeight,
  };

  const riskScore =
    (magnitudeWeight * 0.5 + densityWeight * 0.3 + recencyWeight * 0.2) * 100;
  const level = determineLevel(riskScore);

  return {
    eventId: event.id,
    riskScore: Number(riskScore.toFixed(2)),
    level,
    factors,
    customerDensityId: region?.id,
  };
}

function severityFromRisk(level: RiskScoreResult["level"]): PersistedEvent["severity"] {
  return level;
}

export async function enrichEventWithRisk(
  event: NormalizedEvent
): Promise<PersistedEvent> {
  const regions = await getCustomerDensityRegions();
  const region = deriveRegionForPoint(event.coordinates, regions);
  const risk = computeRiskScore(event, region);

  return {
    ...event,
    severity: event.severity ?? severityFromRisk(risk.level),
    riskScore: risk.riskScore,
    customerDensityId: risk.customerDensityId ?? null,
  };
}

export async function enrichEventsWithRisk(
  events: NormalizedEvent[]
): Promise<PersistedEvent[]> {
  const regions = await getCustomerDensityRegions();

  return Promise.all(
    events.map(async (event) => {
      const region = deriveRegionForPoint(event.coordinates, regions);
      const risk = computeRiskScore(event, region);

      return {
        ...event,
        severity: event.severity ?? severityFromRisk(risk.level),
        riskScore: risk.riskScore,
        customerDensityId: risk.customerDensityId ?? null,
      } satisfies PersistedEvent;
    })
  );
}

export function invalidateCustomerDensityCache(): void {
  cachedRegions = null;
}
