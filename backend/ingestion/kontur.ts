import { readFile } from "node:fs/promises";
import path from "node:path";

import axios from "axios";

import type { NormalizedEvent } from "../../types/events";
import { enrichEventsWithRisk } from "../services/riskScore";
import { upsertEvents } from "../services/eventRepository";
import { publishMapEvents } from "../services/socketEmitter";
import { updateEventsCache } from "../services/stateCache";

const DEFAULT_KONTUR_ENDPOINT = "https://api.kontur.io/risks/v1/events";

interface KonturFeature {
  id: string;
  properties: {
    title?: string;
    description?: string;
    severity?: string;
    category?: string;
    updated?: string;
  };
  geometry?: {
    type: string;
    coordinates?: [number, number, number?];
  };
}

interface KonturResponse {
  features?: KonturFeature[];
}

function extractCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [value[0], value[1]];
  }

  for (const item of value) {
    const result = extractCoordinate(item as unknown);
    if (result) {
      return result;
    }
  }

  return null;
}

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockFeed(): Promise<KonturResponse> {
  const contents = await readFile(resolveMockPath("kontur-events.json"), "utf-8");
  return JSON.parse(contents) as KonturResponse;
}

export function normalizeSeverity(input?: string): NormalizedEvent["severity"] {
  switch (input?.toLowerCase()) {
    case "critical":
    case "severe":
      return "critical";
    case "high":
      return "high";
    case "moderate":
      return "moderate";
    case "low":
      return "low";
    default:
      return "moderate";
  }
}

export function normalizeFeature(feature: KonturFeature): NormalizedEvent | null {
  if (!feature.geometry?.coordinates) {
    return null;
  }

  const coordinateTuple = extractCoordinate(feature.geometry.coordinates);

  if (!coordinateTuple) {
    return null;
  }

  const [longitude, latitude] = coordinateTuple;
  const occurredAt = feature.properties?.updated
    ? new Date(feature.properties.updated).toISOString()
    : new Date().toISOString();

  return {
    id: feature.id,
    title: feature.properties?.title ?? "Kontur Event",
    description: feature.properties?.description ?? feature.properties?.category,
    source: "kontur",
    coordinates: {
      latitude,
      longitude,
      depth: null,
    },
    severity: normalizeSeverity(feature.properties?.severity),
    occurredAt,
    raw: feature,
  } satisfies NormalizedEvent;
}

async function fetchFeed(): Promise<KonturResponse> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][Kontur] Mock mode enabled. Loading local fixture.");
    return loadMockFeed();
  }

  const endpoint = process.env.KONTUR_API_URL ?? DEFAULT_KONTUR_ENDPOINT;
  const apiKey = process.env.KONTUR_API_KEY;

  if (!apiKey) {
    console.warn(
      "[Ingestion][Kontur] KONTUR_API_KEY missing. Skipping live fetch."
    );
    return { features: [] };
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await axios.get<KonturResponse>(endpoint, {
    timeout: Number(process.env.KONTUR_TIMEOUT_MS ?? 10_000),
    headers,
    params: {
      feed: process.env.KONTUR_FEED_ALIAS ?? "kontur-public",
      $top: process.env.KONTUR_TOP ?? undefined,
      $orderby: process.env.KONTUR_ORDERBY ?? undefined,
    },
  });

  return response.data ?? {};
}

export async function ingestKontur(): Promise<void> {
  try {
    const payload = await fetchFeed();

    if (!payload.features?.length) {
      console.warn("[Ingestion][Kontur] Feed returned no features.");
      return;
    }

    const normalized = payload.features
      .map(normalizeFeature)
      .filter((event): event is NormalizedEvent => Boolean(event));

    if (!normalized.length) {
      console.warn("[Ingestion][Kontur] No valid features after normalization.");
      return;
    }

    const enriched = await enrichEventsWithRisk(normalized);

    await upsertEvents(enriched);
    await publishMapEvents(enriched);
    updateEventsCache(enriched);

    console.log(
      `[Ingestion][Kontur] Processed ${enriched.length} events (persisted + emitted).`
    );
  } catch (error) {
    console.error("[Ingestion][Kontur] Failed to process feed", error);
  }
}
