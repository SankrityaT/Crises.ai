import { readFile } from "node:fs/promises";
import path from "node:path";

import axios from "axios";

import type { NormalizedEvent } from "../../types/events";
import { enrichEventsWithRisk } from "../services/riskScore";
import { upsertEvents } from "../services/eventRepository";
import { publishMapEvents } from "../services/socketEmitter";
import { updateEventsCache } from "../services/stateCache";

const DEFAULT_ENDPOINT =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";

interface UsgsFeature {
  id: string;
  properties: {
    title?: string;
    mag?: number;
    place?: string;
    time?: number;
  };
  geometry?: {
    coordinates?: [number, number, number?];
  };
}

interface UsgsResponse {
  features?: UsgsFeature[];
}

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockFeed(): Promise<UsgsResponse> {
  const filePath = resolveMockPath("usgs-feed.json");
  const contents = await readFile(filePath, "utf-8");
  return JSON.parse(contents) as UsgsResponse;
}

export function severityFromMagnitude(
  magnitude?: number | null
): NormalizedEvent["severity"] {
  if (magnitude == null) {
    return "moderate";
  }

  if (magnitude >= 6.5) return "critical";
  if (magnitude >= 5) return "high";
  if (magnitude >= 3.5) return "moderate";
  return "low";
}

export function normalizeFeature(feature: UsgsFeature): NormalizedEvent | null {
  if (!feature.geometry?.coordinates) {
    return null;
  }

  const [longitude, latitude, depth] = feature.geometry.coordinates;

  const magnitude = feature.properties?.mag ?? null;
  const occurredAt = feature.properties?.time
    ? new Date(feature.properties.time).toISOString()
    : new Date().toISOString();

  return {
    id: feature.id,
    title: feature.properties?.title ?? feature.properties?.place ?? "USGS Event",
    description: feature.properties?.place,
    source: "usgs",
    coordinates: {
      latitude,
      longitude,
      depth: depth ?? null,
    },
    magnitude,
    severity: severityFromMagnitude(magnitude),
    occurredAt,
    raw: feature,
  } satisfies NormalizedEvent;
}

async function fetchFeed(): Promise<UsgsResponse> {
  const endpoint = process.env.USGS_API_URL ?? DEFAULT_ENDPOINT;
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][USGS] Mock mode enabled. Loading local fixture.");
    return loadMockFeed();
  }

  const response = await axios.get<UsgsResponse>(endpoint, {
    timeout: Number(process.env.USGS_TIMEOUT_MS ?? 10_000),
  });

  return response.data ?? {};
}

export async function ingestUSGS(): Promise<void> {
  try {
    const payload = await fetchFeed();

    if (!payload.features?.length) {
      console.warn("[Ingestion][USGS] Feed returned no features.");
      return;
    }

    const normalized = payload.features
      .map(normalizeFeature)
      .filter((event): event is NormalizedEvent => Boolean(event));

    if (!normalized.length) {
      console.warn("[Ingestion][USGS] Normalized event list empty after filtering.");
      return;
    }

    const enriched = await enrichEventsWithRisk(normalized);

    await upsertEvents(enriched);

    await publishMapEvents(enriched);
    updateEventsCache(enriched);

    console.log(
      `[Ingestion][USGS] Processed ${enriched.length} events (persisted + emitted).`
    );
  } catch (error) {
    console.error("[Ingestion][USGS] Failed to process feed", error);
  }
}
