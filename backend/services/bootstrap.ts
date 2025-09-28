import { readFile } from "node:fs/promises";
import path from "node:path";

import { desc, eq } from "drizzle-orm";

import type { PersistedEvent } from "../../types/events";
import type {
  Coordinate,
  CustomerDensityRegion,
  EventFeature,
  MapBootstrapPayload,
  PredictionSummary,
  RapidCallCluster,
  SocialHotspot,
} from "../../src/types/map";
import { getDb, isDatabaseConfigured, schema } from "./db";
import {
  getCustomerDensityCache,
  getEventsCache,
  getPredictionsCache,
  getRapidCallsCache,
  getSocialHotspotsCache,
  replaceEventsCache,
  updateCustomerDensityCache,
  updatePredictionsCache,
  updateRapidCallsCache,
  updateSocialHotspotsCache,
} from "./stateCache";
import { publishPredictions } from "./socketEmitter";
import { buildRapidClusters } from "../ingestion/fema";
import {
  deriveKonturHazardContext,
  type KonturFeature,
} from "../ingestion/kontur";

type GeoPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type GeoMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

type GeoGeometry = GeoPolygon | GeoMultiPolygon;

const CUSTOMER_DENSITY_MIN_REGIONS = Number(
  process.env.MAP_MIN_CUSTOMER_REGIONS ?? 18
);

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

function formatCoordinateLabel(lat: number, lng: number): string {
  const latHemisphere = lat >= 0 ? "N" : "S";
  const lonHemisphere = lng >= 0 ? "E" : "W";
  const latitude = Math.abs(lat).toFixed(2);
  const longitude = Math.abs(lng).toFixed(2);
  return `${latitude}°${latHemisphere}, ${longitude}°${lonHemisphere}`;
}

function toEventFeature(event: PersistedEvent): EventFeature {
  let title = event.title;
  let type = event.description ?? event.source;
  let severity = event.severity ?? "moderate";
  let magnitude = event.magnitude ?? undefined;
  let riskScore = event.riskScore;

  const metadata: Record<string, unknown> = {
    riskScore,
    customerDensityId: event.customerDensityId,
  };

  if (event.source === "kontur") {
    const rawFeature = (event.raw as KonturFeature | undefined) ?? undefined;
    const hazard = deriveKonturHazardContext(rawFeature, event.id);

    if (!type || type.toLowerCase() === "kontur") {
      type = hazard.label;
    }

    const locationName = rawFeature?.properties?.locationName?.trim();
    if (!title || title.toLowerCase().includes("kontur event")) {
      const locationLabel = locationName || `near ${formatCoordinateLabel(event.coordinates.latitude, event.coordinates.longitude)}`;
      title = `${hazard.label} – ${locationLabel}`;
    }

    severity = hazard.severity ?? severity;
    if (magnitude == null || magnitude === 0) {
      magnitude = hazard.magnitude;
    }

    if (riskScore == null || Math.round(riskScore) === 41) {
      riskScore = hazard.riskScore;
      metadata.riskScore = riskScore;
    }

    metadata.hazardLabel = hazard.label;
  }

  return {
    id: event.id,
    title,
    source: event.source as EventFeature["source"],
    type,
    severity,
    magnitude,
    startedAt: event.occurredAt,
    coordinates: {
      lat: event.coordinates.latitude,
      lng: event.coordinates.longitude,
    },
    metadata,
  } satisfies EventFeature;
}

function deriveRiskProfile(densityScore: number): "low" | "medium" | "high" {
  if (densityScore >= 0.75) return "high";
  if (densityScore >= 0.45) return "medium";
  return "low";
}

function geometryToCoordinates(geometry: GeoGeometry | undefined): Coordinate[] {
  if (!geometry) {
    return [];
  }

  const convertRing = (ring: number[][]): Coordinate[] =>
    ring
      ?.map((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return null;
        const [lng, lat] = pair;
        if (typeof lat !== "number" || typeof lng !== "number") return null;
        return { lat, lng } satisfies Coordinate;
      })
      .filter((coord): coord is Coordinate => coord != null) ?? [];

  if (geometry.type === "Polygon") {
    return convertRing(geometry.coordinates?.[0] ?? []);
  }

  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates ?? [];
    let selected: number[][] | null = null;
    let maxLen = 0;

    for (const polygon of polygons) {
      const ring = polygon?.[0];
      if (Array.isArray(ring) && ring.length > maxLen) {
        selected = ring;
        maxLen = ring.length;
      }
    }

    if (selected) {
      return convertRing(selected);
    }
  }

  return [];
}

function ensureCustomerCount(region: CustomerDensityRegion): number {
  const existing = region.customerCount;
  if (typeof existing === "number" && Number.isFinite(existing) && existing > 0) {
    return Math.round(existing);
  }

  const population = region.population ?? 150_000;
  const density = Number.isFinite(region.densityScore)
    ? Math.max(0, region.densityScore)
    : 0.3;

  return Math.max(500, Math.round(population * Math.max(0.05, density * 0.2)));
}

async function loadCustomerDensityFixtures(): Promise<CustomerDensityRegion[]> {
  try {
    const content = await readFile(resolveMockPath("customer_density.geojson"), "utf-8");
    const json = JSON.parse(content) as {
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
      customerCount: feature.properties.customerCount,
      riskProfile: feature.properties.riskProfile,
      geometry: feature.geometry,
    }));
  } catch (error) {
    console.warn("[Bootstrap] Failed to load customer density fixtures", error);
    return [];
  }
}

function enrichCustomerDensityRegion(
  region: CustomerDensityRegion
): CustomerDensityRegion | null {
  const geometry = region.geometry as GeoGeometry | undefined;
  const coordinates = region.coordinates ?? geometryToCoordinates(geometry);

  if (!coordinates || !coordinates.length) {
    return null;
  }

  const riskProfile = region.riskProfile ?? deriveRiskProfile(region.densityScore ?? 0);
  const customerCount = ensureCustomerCount(region);

  return {
    ...region,
    coordinates,
    riskProfile,
    customerCount,
  } satisfies CustomerDensityRegion;
}

async function buildCustomerDensityRegions(
  regions: CustomerDensityRegion[]
): Promise<CustomerDensityRegion[]> {
  const seen = new Map<string, CustomerDensityRegion>();

  for (const region of regions) {
    const enriched = enrichCustomerDensityRegion(region);
    if (enriched) {
      seen.set(enriched.id, enriched);
    }
  }

  if (seen.size < CUSTOMER_DENSITY_MIN_REGIONS) {
    const fixtures = await loadCustomerDensityFixtures();
    for (const fixture of fixtures) {
      if (!seen.has(fixture.id)) {
        const enriched = enrichCustomerDensityRegion(fixture);
        if (enriched) {
          seen.set(enriched.id, enriched);
        }
      }
      if (seen.size >= CUSTOMER_DENSITY_MIN_REGIONS) {
        break;
      }
    }
  }

  if (!seen.size) {
    const fixtures = await loadCustomerDensityFixtures();
    fixtures.forEach((fixture, index) => {
      if (seen.size >= CUSTOMER_DENSITY_MIN_REGIONS) {
        return;
      }
      const enriched = enrichCustomerDensityRegion(fixture);
      if (enriched) {
        seen.set(enriched.id ?? `fixture_${index}`, enriched);
      }
    });
  }

  return Array.from(seen.values());
}

const DEFAULT_BOOTSTRAP_EVENT_LIMIT = Number(process.env.MAP_EVENT_LIMIT ?? 300);
const MIN_USGS_EVENTS = Number(process.env.MAP_MIN_USGS_EVENTS ?? 12);

async function fetchEventsFromDatabase(
  limit = DEFAULT_BOOTSTRAP_EVENT_LIMIT
): Promise<PersistedEvent[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.events)
    .orderBy(desc(schema.events.occurredAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    source: row.source as PersistedEvent["source"],
    coordinates: {
      latitude: row.latitude,
      longitude: row.longitude,
      depth: row.depth ?? undefined,
    },
    severity: row.severity as PersistedEvent["severity"],
    magnitude: row.magnitude ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    raw: row.raw,
    riskScore: row.riskScore ?? undefined,
    customerDensityId: row.customerDensityId ?? undefined,
  } satisfies PersistedEvent));
}

async function fetchEventsBySource(
  source: PersistedEvent["source"],
  limit: number
): Promise<PersistedEvent[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.source, source))
    .orderBy(desc(schema.events.occurredAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    source: row.source as PersistedEvent["source"],
    coordinates: {
      latitude: row.latitude,
      longitude: row.longitude,
      depth: row.depth ?? undefined,
    },
    severity: row.severity as PersistedEvent["severity"],
    magnitude: row.magnitude ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    raw: row.raw,
    riskScore: row.riskScore ?? undefined,
    customerDensityId: row.customerDensityId ?? undefined,
  } satisfies PersistedEvent));
}

async function loadRapidMocks(): Promise<RapidCallCluster[]> {
  try {
    const content = await readFile(resolveMockPath("rapid-calls.json"), "utf-8");
    const json = JSON.parse(content) as { rapidCalls?: Array<{
      id: string;
      coordinates: { lat: number; lng: number };
      incidentType: string;
      callCount: number;
      severity: string;
      lastUpdated: string;
    }> };

    const rapidCalls = json.rapidCalls ?? [];
    if (!rapidCalls.length) {
      return [];
    }

    return rapidCalls.map(call => ({
      id: call.id,
      coordinates: call.coordinates,
      incidentType: call.incidentType,
      callCount: call.callCount,
      volume: call.callCount, // For backward compatibility
      severity: call.severity as any,
      lastUpdated: call.lastUpdated,
    }));
  } catch (error) {
    console.warn("[Bootstrap] Failed to load rapid call mocks, returning empty array", error);
    return [];
  }
}

async function loadSocialMocks(): Promise<SocialHotspot[]> {
  const content = await readFile(resolveMockPath("social-mentions.json"), "utf-8");
  const json = JSON.parse(content) as { mentions?: Array<{
    id: string;
    sentiment_score: number;
    mention_count?: number;
    latitude?: number;
    longitude?: number;
    captured_at: string;
  }>; };

  return (
    json.mentions
      ?.filter((mention) => mention.latitude != null && mention.longitude != null)
      .map((mention) => ({
        id: mention.id,
        sentimentScore: mention.sentiment_score,
        mentionCount: mention.mention_count ?? 0,
        coordinates: {
          lat: mention.latitude as number,
          lng: mention.longitude as number,
        },
        lastUpdated: new Date(mention.captured_at).toISOString(),
      })) ?? []
  );
}

async function loadPredictionMocks(): Promise<PredictionSummary[]> {
  const content = await readFile(resolveMockPath("predictions.json"), "utf-8");
  const json = JSON.parse(content) as { predictions?: Array<{
    id: string;
    label: string;
    expected_claims: number;
    adjusters_needed: number;
    generated_at: string;
  }>; };

  return (
    json.predictions?.map((prediction) => ({
      id: prediction.id,
      label: prediction.label,
      expectedClaims: prediction.expected_claims,
      adjustersNeeded: prediction.adjusters_needed,
      generatedAt: new Date(prediction.generated_at).toISOString(),
    })) ?? []
  );
}

async function loadCustomerDensityMocks(): Promise<CustomerDensityRegion[]> {
  const content = await readFile(resolveMockPath("customer_density.geojson"), "utf-8");
  const json = JSON.parse(content) as {
    features: Array<{
      id?: string;
      properties: {
        name: string;
        densityScore: number;
        population?: number;
      };
      geometry: unknown;
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

async function fetchPredictionsFromDatabase(): Promise<PredictionSummary[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.predictions)
    .orderBy(desc(schema.predictions.generatedAt));

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    expectedClaims: row.expectedClaims,
    adjustersNeeded: row.adjustersNeeded,
    generatedAt: row.generatedAt.toISOString(),
  } satisfies PredictionSummary));
}

async function fetchCustomerDensityFromDb(): Promise<CustomerDensityRegion[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDb();
  const rows = await db.select().from(schema.customerDensity);

  return rows.map((row) => ({
    id: row.id,
    regionName: row.regionName,
    densityScore: Number(row.densityScore ?? 0),
    population: row.population ?? undefined,
    geometry: row.geom,
  } satisfies CustomerDensityRegion));
}

async function loadMockEvents(): Promise<EventFeature[]> {
  const mockEvents: EventFeature[] = [];
  
  try {
    // Load FEMA mock events
    const femaContent = await readFile(resolveMockPath("fema-declarations.json"), "utf-8");
    const femaJson = JSON.parse(femaContent) as { disasters?: Array<{
      id: string;
      incidentType: string;
      declarationTitle: string;
      incidentBeginDate: string;
      state: string;
    }> };
    
    femaJson.disasters?.forEach(disaster => {
      mockEvents.push({
        id: disaster.id,
        title: disaster.declarationTitle,
        source: "fema",
        type: disaster.incidentType.toLowerCase(),
        severity: disaster.incidentType === "Hurricane" ? "critical" : 
                 disaster.incidentType === "Fire" ? "high" : "moderate",
        startedAt: disaster.incidentBeginDate,
        coordinates: { lat: 37.7749, lng: -122.4194 }, // Default coordinates
      });
    });

    // Load Kontur mock events
    const konturContent = await readFile(resolveMockPath("kontur-events.json"), "utf-8");
    const konturJson = JSON.parse(konturContent) as { features?: Array<{
      id: string;
      properties: {
        title: string;
        description: string;
        severity: string;
        category: string;
        updated: string;
      };
      geometry: {
        coordinates: [number, number];
      };
    }> };
    
    konturJson.features?.forEach(feature => {
      mockEvents.push({
        id: feature.id,
        title: feature.properties.title,
        source: "kontur",
        type: feature.properties.category,
        severity: feature.properties.severity as any,
        startedAt: feature.properties.updated,
        coordinates: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
      });
    });

    // Load USGS mock events
    const usgsContent = await readFile(resolveMockPath("usgs-feed.json"), "utf-8");
    const usgsJson = JSON.parse(usgsContent) as { features?: Array<{
      id: string;
      properties: {
        title: string;
        mag: number;
        time: number;
      };
      geometry: {
        coordinates: [number, number, number];
      };
    }> };
    
    usgsJson.features?.forEach(feature => {
      mockEvents.push({
        id: feature.id,
        title: feature.properties.title,
        source: "usgs",
        type: "earthquake",
        severity: feature.properties.mag >= 4.0 ? "high" : "moderate",
        magnitude: feature.properties.mag,
        startedAt: new Date(feature.properties.time).toISOString(),
        coordinates: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
      });
    });
  } catch (error) {
    console.warn("[Bootstrap] Failed to load mock events", error);
  }
  
  return mockEvents;
}

export async function getBootstrapPayload(): Promise<MapBootstrapPayload> {
  let events = getEventsCache();

  if (!events.length) {
    events = await fetchEventsFromDatabase();
    if (!events.length) {
      // Load mock events if database is empty
      const mockEvents = await loadMockEvents();
      events = mockEvents.map(event => ({
        id: event.id,
        title: event.title,
        description: event.type,
        source: event.source as any,
        coordinates: {
          latitude: event.coordinates.lat,
          longitude: event.coordinates.lng,
        },
        severity: event.severity as any,
        magnitude: event.magnitude,
        occurredAt: event.startedAt,
        raw: {},
      }));
    }
    if (events.length) {
      replaceEventsCache(events);
    }
  }

  if (events.length && MIN_USGS_EVENTS > 0) {
    const usgsCount = events.filter((event) => event.source === "usgs").length;

    if (usgsCount < MIN_USGS_EVENTS) {
      const additionalUsgs = await fetchEventsBySource(
        "usgs",
        Math.max(MIN_USGS_EVENTS * 2, 50)
      );

      if (additionalUsgs.length) {
        const merged = new Map<string, PersistedEvent>();
        for (const event of [...events, ...additionalUsgs]) {
          merged.set(event.id, event);
        }

        const mergedEvents = Array.from(merged.values()).sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );

        const usgsEvents = mergedEvents.filter((event) => event.source === "usgs");
        const otherEvents = mergedEvents.filter((event) => event.source !== "usgs");

        const targetUsgsCount = Math.min(
          usgsEvents.length,
          Math.max(MIN_USGS_EVENTS, usgsCount)
        );

        const selectedUsgs = usgsEvents.slice(0, targetUsgsCount);
        const remainingSlots = Math.max(
          DEFAULT_BOOTSTRAP_EVENT_LIMIT - selectedUsgs.length,
          0
        );
        const selectedOthers = remainingSlots
          ? otherEvents.slice(0, remainingSlots)
          : [];

        events = [...selectedUsgs, ...selectedOthers].sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
      }
    }
  }

  const eventFeatures = events.map(toEventFeature);

  let rapidCalls = getRapidCallsCache();
  if (!rapidCalls.length) {
    rapidCalls = await loadRapidMocks();
    if (rapidCalls.length) {
      updateRapidCallsCache(rapidCalls);
    }
  }

  let socialHotspots = getSocialHotspotsCache();
  if (!socialHotspots.length) {
    socialHotspots = await loadSocialMocks();
    if (socialHotspots.length) {
      updateSocialHotspotsCache(socialHotspots);
    }
  }

  let predictions = getPredictionsCache();
  if (!predictions.length) {
    predictions = await fetchPredictionsFromDatabase();
    if (!predictions.length) {
      predictions = await loadPredictionMocks();
    }
    if (predictions.length) {
      updatePredictionsCache(predictions);
      void publishPredictions(predictions).catch((error) => {
        console.warn("[Bootstrap] Failed to publish predictions snapshot", error);
      });
    }
  }

  let customerDensity = getCustomerDensityCache();
  if (!customerDensity.length) {
    customerDensity = await fetchCustomerDensityFromDb();
    if (!customerDensity.length) {
      customerDensity = await loadCustomerDensityMocks();
    }
  }

  customerDensity = await buildCustomerDensityRegions(customerDensity);
  if (customerDensity.length) {
    updateCustomerDensityCache(customerDensity);
  }

  return {
    events: eventFeatures,
    rapidCalls,
    socialHotspots,
    predictions,
    customerDensity,
  } satisfies MapBootstrapPayload;
}
