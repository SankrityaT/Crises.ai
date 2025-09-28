import { readFile } from "node:fs/promises";
import path from "node:path";

import { desc } from "drizzle-orm";

import type { PersistedEvent } from "../../types/events";
import type {
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

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

function toEventFeature(event: PersistedEvent): EventFeature {
  return {
    id: event.id,
    title: event.title,
    source: event.source as EventFeature["source"],
    type: event.description ?? event.source,
    severity: event.severity ?? "moderate",
    magnitude: event.magnitude ?? undefined,
    startedAt: event.occurredAt,
    coordinates: {
      lat: event.coordinates.latitude,
      lng: event.coordinates.longitude,
    },
    metadata: {
      riskScore: event.riskScore,
      customerDensityId: event.customerDensityId,
    },
  } satisfies EventFeature;
}

async function fetchEventsFromDatabase(limit = 100): Promise<PersistedEvent[]> {
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

async function loadRapidMocks(): Promise<RapidCallCluster[]> {
  const content = await readFile(resolveMockPath("rapidsos-incidents.json"), "utf-8");
  const json = JSON.parse(content) as { disasters?: Array<{
    id?: string;
    disasterNumber: number;
    state: string;
    incidentType: string;
    declarationType?: string;
    declarationTitle?: string;
    designatedArea?: string;
    declarationDate?: string;
    incidentBeginDate?: string;
    lastRefresh?: string;
  }> };

  const disasters = json.disasters ?? [];
  if (!disasters.length) {
    return [];
  }

  return buildRapidClusters(disasters);
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

export async function getBootstrapPayload(): Promise<MapBootstrapPayload> {
  let events = getEventsCache();

  if (!events.length) {
    events = await fetchEventsFromDatabase();
    if (events.length) {
      replaceEventsCache(events);
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
    if (customerDensity.length) {
      updateCustomerDensityCache(customerDensity);
    }
  }

  return {
    events: eventFeatures,
    rapidCalls,
    socialHotspots,
    predictions,
    customerDensity,
  } satisfies MapBootstrapPayload;
}
