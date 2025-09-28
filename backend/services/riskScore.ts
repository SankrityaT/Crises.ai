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

interface LatLngCoordinate {
  lat: number;
  lng: number;
}

interface CustomerDensityRegion {
  id: string;
  regionName: string;
  densityScore: number;
  population?: number;
  geometry: GeoGeometry;
  customerCount?: number;
  riskProfile?: "low" | "medium" | "high";
  coordinates?: LatLngCoordinate[];
}

let cachedRegions: CustomerDensityRegion[] | null = null;

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

function deriveRiskProfile(densityScore: number): "low" | "medium" | "high" {
  if (densityScore >= 0.75) return "high";
  if (densityScore >= 0.45) return "medium";
  return "low";
}

function estimateCustomerCount(
  densityScore: number,
  population?: number
): number {
  const safeDensity = Number.isFinite(densityScore) ? Math.max(0, densityScore) : 0;

  if (population && population > 0) {
    return Math.max(500, Math.round(population * Math.max(0.05, safeDensity * 0.25)));
  }

  if (safeDensity > 0) {
    return Math.round(5_000 + safeDensity * 20_000);
  }

  return 5_000;
}

function ringToCoordinates(ring: number[][]): LatLngCoordinate[] {
  if (!Array.isArray(ring)) {
    return [];
  }

  return ring
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) {
        return null;
      }
      const [longitude, latitude] = pair;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return null;
      }
      return { lat: latitude, lng: longitude } satisfies LatLngCoordinate;
    })
    .filter((coord, index, array): coord is LatLngCoordinate => {
      if (!coord) return false;
      if (index === 0) return true;
      const previous = array[index - 1];
      return !previous || previous.lat !== coord.lat || previous.lng !== coord.lng;
    });
}

function geometryToCoordinates(geometry: GeoGeometry): LatLngCoordinate[] {
  if (!geometry) {
    return [];
  }

  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates?.[0] ?? [];
    return ringToCoordinates(ring);
  }

  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates ?? [];
    let selected: number[][] | null = null;
    let maxVertices = 0;

    for (const polygon of polygons) {
      const ring = polygon?.[0];
      if (Array.isArray(ring) && ring.length > maxVertices) {
        selected = ring;
        maxVertices = ring.length;
      }
    }

    if (selected) {
      return ringToCoordinates(selected);
    }
  }

  return [];
}

function normalizeRegion(row: CustomerDensityRow): CustomerDensityRegion {
  return {
    id: row.id,
    regionName: row.regionName,
    densityScore: Number(row.densityScore ?? 0),
    population: row.population ?? undefined,
    geometry: row.geom as GeoGeometry,
    customerCount: estimateCustomerCount(
      Number(row.densityScore ?? 0),
      row.population ?? undefined
    ),
    riskProfile: deriveRiskProfile(Number(row.densityScore ?? 0)),
    coordinates: geometryToCoordinates(row.geom as GeoGeometry),
  };
}

async function loadRegionsFromDatabase(): Promise<CustomerDensityRegion[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDb();
  const rows = await db.select().from(schema.customerDensity);
  const regions = rows.map(normalizeRegion);
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
        customerCount?: number;
        riskProfile?: "low" | "medium" | "high";
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
    customerCount:
      feature.properties.customerCount ??
      estimateCustomerCount(feature.properties.densityScore, feature.properties.population),
    riskProfile:
      feature.properties.riskProfile ?? deriveRiskProfile(feature.properties.densityScore),
    coordinates: geometryToCoordinates(feature.geometry),
  }));
}

const MIN_CUSTOMER_REGIONS = Number(process.env.MAP_MIN_CUSTOMER_REGIONS ?? 18);

async function getCustomerDensityRegions(): Promise<CustomerDensityRegion[]> {
  if (cachedRegions) {
    return cachedRegions;
  }

  const regions: CustomerDensityRegion[] = [];
  const seen = new Set<string>();

  const databaseRegions = await loadRegionsFromDatabase();
  for (const region of databaseRegions) {
    if (!seen.has(region.id)) {
      regions.push(region);
      seen.add(region.id);
    }
  }

  if (regions.length < MIN_CUSTOMER_REGIONS) {
    const mockRegions = await loadRegionsFromMock();
    for (const region of mockRegions) {
      if (!seen.has(region.id)) {
        regions.push(region);
        seen.add(region.id);
      }
      if (regions.length >= MIN_CUSTOMER_REGIONS) {
        break;
      }
    }
  }

  if (!regions.length) {
    regions.push(...(await loadRegionsFromMock()));
  }

  cachedRegions = regions;
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

function seededRandom(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }

  const normalized = Math.abs(Math.sin(h)) % 1;
  const value = min + (max - min) * normalized;
  return Number(value.toFixed(2));
}

function normalizeDensity(densityScore?: number): number {
  if (!densityScore || Number.isNaN(densityScore)) {
    return 0.2;
  }

  // Ensure density score is between 0 and 1
  const normalized = Math.max(0, Math.min(Number(densityScore), 1));
  return normalized;
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

  // Calculate weighted score (0-1 range) then convert to percentage
  const weightedScore = magnitudeWeight * 0.5 + densityWeight * 0.3 + recencyWeight * 0.2;
  let riskScore = Math.min(100, Math.max(0, weightedScore * 100));

  if (event.source === "kontur") {
    let hazardRisk: number | undefined;
    if (typeof event.raw === "object" && event.raw) {
      const raw = event.raw as { hazard?: { riskScore?: number } };
      if (typeof raw.hazard?.riskScore === "number") {
        hazardRisk = raw.hazard.riskScore;
      }
    }

    const magnitudeBoost =
      event.magnitude != null ? Math.min(25, Math.max(0, (event.magnitude / 6) * 18)) : 8;
    const variation = seededRandom(`${event.id}-risk`, -7, 9);
    const blended = hazardRisk != null ? (hazardRisk * 0.6 + riskScore * 0.4) : riskScore;
    riskScore = Math.min(95, Math.max(6, Number((blended + magnitudeBoost + variation).toFixed(1))));
  }

  const level = determineLevel(riskScore);

  return {
    eventId: event.id,
    riskScore: Number(riskScore.toFixed(1)), // Round to 1 decimal place
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
