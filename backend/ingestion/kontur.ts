import { readFile } from "node:fs/promises";
import path from "node:path";

import axios from "axios";

import type { NormalizedEvent } from "../../types/events";
import { enrichEventsWithRisk } from "../services/riskScore";
import { upsertEvents } from "../services/eventRepository";
import { publishMapEvents } from "../services/socketEmitter";
import { updateEventsCache } from "../services/stateCache";

// Kontur is a geospatial data provider - disable for now as it's generating too many generic events
const DEFAULT_KONTUR_ENDPOINT = "https://api.kontur.io/risks/v1/events";

export interface KonturFeature {
  id: string;
  properties: {
    title?: string;
    description?: string;
    severity?: string;
    category?: string;
    updated?: string;
    locationName?: string;
  };
  geometry?: {
    type: string;
    coordinates?: [number, number, number?];
  };
}

type HazardSeverity = NormalizedEvent["severity"];

interface KonturHazardProfile {
  label: string;
  severity: HazardSeverity;
  magnitudeRange: [number, number];
  keywords?: string[];
}

export interface KonturHazardContext {
  label: string;
  severity: HazardSeverity;
  magnitude: number;
  riskScore: number;
}

const HAZARD_PROFILES: KonturHazardProfile[] = [
  {
    label: "Wildfire Threat",
    severity: "high",
    magnitudeRange: [3.2, 5.4],
    keywords: ["fire", "heat", "wildfire", "hotspot", "burn"],
  },
  {
    label: "Flash Flood Watch",
    severity: "high",
    magnitudeRange: [2.8, 4.8],
    keywords: ["flood", "rain", "river", "water", "storm surge"],
  },
  {
    label: "Severe Storm Risk",
    severity: "high",
    magnitudeRange: [2.5, 4.2],
    keywords: ["storm", "wind", "hurricane", "cyclone", "lightning"],
  },
  {
    label: "Landslide Concern",
    severity: "moderate",
    magnitudeRange: [1.8, 3.6],
    keywords: ["landslide", "slope", "erosion", "soil"],
  },
  {
    label: "Infrastructure Impact",
    severity: "moderate",
    magnitudeRange: [1.4, 3.2],
    keywords: ["infrastructure", "power", "facility", "industrial"],
  },
  {
    label: "Heat Stress Alert",
    severity: "moderate",
    magnitudeRange: [1.6, 3.0],
    keywords: ["temperature", "heat", "drought"],
  },
  {
    label: "Air Quality Warning",
    severity: "moderate",
    magnitudeRange: [1.2, 2.6],
    keywords: ["smoke", "air", "pollution"],
  },
];

const FALLBACK_PROFILES: KonturHazardProfile[] = [
  { label: "Critical Response Needed", severity: "critical", magnitudeRange: [3.6, 5.8] },
  { label: "High Impact Alert", severity: "high", magnitudeRange: [2.8, 4.6] },
  { label: "Moderate Risk Zone", severity: "moderate", magnitudeRange: [1.5, 3.5] },
  { label: "Emerging Hazard Signal", severity: "moderate", magnitudeRange: [1.2, 2.8] },
];

function seededRandom(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0; // Convert to 32bit integer
  }

  const normalized = Math.abs(Math.sin(h)) % 1;
  const value = min + (max - min) * normalized;
  return Number(value.toFixed(2));
}

function pickHazardProfile(
  category: string | undefined,
  severityHint: HazardSeverity,
  seed: string
): KonturHazardProfile {
  if (category) {
    const lowered = category.toLowerCase();
    const match = HAZARD_PROFILES.find((profile) =>
      profile.keywords?.some((keyword) => lowered.includes(keyword))
    );
    if (match) {
      return match;
    }
  }

  if (severityHint === "critical") {
    return FALLBACK_PROFILES[0];
  }

  if (severityHint === "high") {
    return FALLBACK_PROFILES[1];
  }

  const index = Math.floor(seededRandom(`${seed}-profile`, 0, FALLBACK_PROFILES.length));
  return FALLBACK_PROFILES[index % FALLBACK_PROFILES.length];
}

export function deriveKonturHazardContext(
  feature: KonturFeature | undefined,
  seed: string
): KonturHazardContext {
  const severityHint = normalizeSeverity(feature?.properties?.severity);
  const profile = pickHazardProfile(feature?.properties?.category, severityHint, seed);
  const severity: HazardSeverity = profile.severity ?? severityHint;
  const magnitude = seededRandom(`${seed}-mag`, profile.magnitudeRange[0], profile.magnitudeRange[1]);

  const baseRisk =
    severity === "critical"
      ? 78
      : severity === "high"
        ? 58
        : severity === "moderate"
          ? 41
          : 24;
  const riskVariation = seededRandom(`${seed}-risk`, -9, 11);
  const magnitudeInfluence = (magnitude - profile.magnitudeRange[0]) * 4;
  const riskScore = Math.min(
    95,
    Math.max(7, Number((baseRisk + riskVariation + magnitudeInfluence).toFixed(1)))
  );

  return {
    label: profile.label,
    severity,
    magnitude: Number(magnitude.toFixed(1)),
    riskScore,
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

function toTitleCase(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatCoordinate(latitude: number, longitude: number): string {
  const latHemisphere = latitude >= 0 ? "N" : "S";
  const lonHemisphere = longitude >= 0 ? "E" : "W";
  const lat = Math.abs(latitude).toFixed(2);
  const lon = Math.abs(longitude).toFixed(2);
  return `${lat}°${latHemisphere}, ${lon}°${lonHemisphere}`;
}

function buildKonturTitle(
  feature: KonturFeature,
  latitude: number,
  longitude: number,
  hazardLabel: string
): { title: string; location: string } {
  const locationName = feature.properties?.locationName?.trim();
  const location = locationName || `near ${formatCoordinate(latitude, longitude)}`;
  const title = `${hazardLabel} – ${location}`;
  return { title, location };
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

  const hazard = deriveKonturHazardContext(feature, feature.id);
  const { title, location } = buildKonturTitle(feature, latitude, longitude, hazard.label);

  const rawPayload = {
    ...feature,
    hazard,
    generatedTitle: title,
    generatedLocation: location,
  } satisfies KonturFeature & {
    hazard: KonturHazardContext;
    generatedTitle: string;
    generatedLocation: string;
  };

  return {
    id: feature.id,
    title,
    description: hazard.label,
    source: "kontur",
    coordinates: {
      latitude,
      longitude,
      depth: null,
    },
    severity: hazard.severity,
    magnitude: hazard.magnitude,
    occurredAt,
    raw: rawPayload,
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
    console.log("[Ingestion][Kontur] Skipping Kontur ingestion (temporarily disabled)");
    return;
  } catch (error) {
    console.error("[Ingestion][Kontur] Failed to process feed", error);
  }
}
