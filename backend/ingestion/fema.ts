import { readFile } from "node:fs/promises";
import path from "node:path";

import axios from "axios";

import type { NormalizedEvent } from "../../types/events";
import type { RapidCallCluster } from "../../src/types/map";
import { enrichEventsWithRisk } from "../services/riskScore";
import { upsertEvents } from "../services/eventRepository";
import {
  publishMapEvents,
  publishRapidClusters,
} from "../services/socketEmitter";
import {
  updateEventsCache,
  updateRapidCallsCache,
} from "../services/stateCache";

const DEFAULT_FEMA_ENDPOINT =
  "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries";

interface FemaDisasterRecord {
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
}

interface FemaResponse {
  DisasterDeclarationsSummaries?: FemaDisasterRecord[];
}

const STATE_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  AL: { latitude: 32.806671, longitude: -86.79113 },
  AK: { latitude: 61.370716, longitude: -152.404419 },
  AZ: { latitude: 33.729759, longitude: -111.431221 },
  AR: { latitude: 34.969704, longitude: -92.373123 },
  CA: { latitude: 36.116203, longitude: -119.681564 },
  CO: { latitude: 39.059811, longitude: -105.311104 },
  CT: { latitude: 41.597782, longitude: -72.755371 },
  DE: { latitude: 39.318523, longitude: -75.507141 },
  FL: { latitude: 27.766279, longitude: -81.686783 },
  GA: { latitude: 33.040619, longitude: -83.643074 },
  HI: { latitude: 21.094318, longitude: -157.498337 },
  ID: { latitude: 44.240459, longitude: -114.478828 },
  IL: { latitude: 40.349457, longitude: -88.986137 },
  IN: { latitude: 39.849426, longitude: -86.258278 },
  IA: { latitude: 42.011539, longitude: -93.210526 },
  KS: { latitude: 38.5266, longitude: -96.726486 },
  KY: { latitude: 37.66814, longitude: -84.670067 },
  LA: { latitude: 31.169546, longitude: -91.867805 },
  ME: { latitude: 44.693947, longitude: -69.381927 },
  MD: { latitude: 39.063946, longitude: -76.802101 },
  MA: { latitude: 42.230171, longitude: -71.530106 },
  MI: { latitude: 43.326618, longitude: -84.536095 },
  MN: { latitude: 45.694454, longitude: -93.900192 },
  MS: { latitude: 32.741646, longitude: -89.678696 },
  MO: { latitude: 38.456085, longitude: -92.288368 },
  MT: { latitude: 46.921925, longitude: -110.454353 },
  NE: { latitude: 41.12537, longitude: -98.268082 },
  NV: { latitude: 38.313515, longitude: -117.055374 },
  NH: { latitude: 43.452492, longitude: -71.563896 },
  NJ: { latitude: 40.298904, longitude: -74.521011 },
  NM: { latitude: 34.840515, longitude: -106.248482 },
  NY: { latitude: 42.165726, longitude: -74.948051 },
  NC: { latitude: 35.630066, longitude: -79.806419 },
  ND: { latitude: 47.528912, longitude: -99.784012 },
  OH: { latitude: 40.388783, longitude: -82.764915 },
  OK: { latitude: 35.565342, longitude: -96.928917 },
  OR: { latitude: 44.572021, longitude: -122.070938 },
  PA: { latitude: 40.590752, longitude: -77.209755 },
  RI: { latitude: 41.680893, longitude: -71.51178 },
  SC: { latitude: 33.856892, longitude: -80.945007 },
  SD: { latitude: 44.299782, longitude: -99.438828 },
  TN: { latitude: 35.747845, longitude: -86.692345 },
  TX: { latitude: 31.054487, longitude: -97.563461 },
  UT: { latitude: 40.150032, longitude: -111.862434 },
  VT: { latitude: 44.045876, longitude: -72.710686 },
  VA: { latitude: 37.769337, longitude: -78.169968 },
  WA: { latitude: 47.400902, longitude: -121.490494 },
  WV: { latitude: 38.491226, longitude: -80.954453 },
  WI: { latitude: 44.268543, longitude: -89.616508 },
  WY: { latitude: 42.755966, longitude: -107.30249 },
  DC: { latitude: 38.907192, longitude: -77.036873 },
  PR: { latitude: 18.220833, longitude: -66.590149 },
  VI: { latitude: 18.335765, longitude: -64.896335 }
};

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockFeed(): Promise<FemaDisasterRecord[]> {
  const contents = await readFile(resolveMockPath("fema-declarations.json"), "utf-8");
  const json = JSON.parse(contents) as { disasters?: FemaDisasterRecord[] };
  return json.disasters ?? [];
}

function getCoordinates(state: string): { latitude: number; longitude: number } {
  return (
    STATE_COORDINATES[state as keyof typeof STATE_COORDINATES] ??
    STATE_COORDINATES.DC
  );
}

export function severityFromDisaster(
  record: FemaDisasterRecord
): NormalizedEvent["severity"] {
  const type = record.incidentType?.toLowerCase() ?? "";
  if (type.includes("hurricane") || type.includes("pandemic")) {
    return "critical";
  }
  if (type.includes("fire") || type.includes("tornado") || type.includes("earthquake")) {
    return "high";
  }
  if (type.includes("flood") || type.includes("storm")) {
    return "moderate";
  }
  return "low";
}

function occurrenceDate(record: FemaDisasterRecord): string {
  const dateString =
    record.incidentBeginDate ?? record.declarationDate ?? record.lastRefresh;
  const date = dateString ? new Date(dateString) : new Date();
  return date.toISOString();
}

export function normalizeDisaster(record: FemaDisasterRecord): NormalizedEvent {
  const coords = getCoordinates(record.state);

  return {
    id: `fema_${record.id ?? record.disasterNumber}`,
    title: record.declarationTitle ?? `FEMA Declaration ${record.disasterNumber}`,
    description: record.designatedArea
      ? `${record.designatedArea} (${record.state})`
      : `Statewide declaration for ${record.state}`,
    source: "fema",
    coordinates: {
      latitude: coords.latitude,
      longitude: coords.longitude,
    },
    severity: severityFromDisaster(record),
    magnitude: undefined,
    occurredAt: occurrenceDate(record),
    raw: record,
  } satisfies NormalizedEvent;
}

export function buildRapidClusters(
  records: FemaDisasterRecord[]
): RapidCallCluster[] {
  const clusters = new Map<string, RapidCallCluster & { volume: number }>();

  for (const record of records) {
    const coords = getCoordinates(record.state);
    const key = `${record.state}_${record.incidentType}`;
    const existing = clusters.get(key);
    const lastUpdated = occurrenceDate(record);

    if (existing) {
      existing.volume += 1;
      if (new Date(lastUpdated) > new Date(existing.lastUpdated)) {
        existing.lastUpdated = lastUpdated;
      }
    } else {
      clusters.set(key, {
        id: key,
        coordinates: {
          lat: coords.latitude,
          lng: coords.longitude,
        },
        incidentType: record.incidentType,
        volume: 1,
        lastUpdated,
      });
    }
  }

  return Array.from(clusters.values());
}

async function fetchDisasters(): Promise<FemaDisasterRecord[]> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][FEMA] Mock mode enabled. Loading local fixture.");
    return loadMockFeed();
  }

  const endpoint = process.env.FEMA_DECLARATIONS_URL ?? DEFAULT_FEMA_ENDPOINT;
  const timeout = Number(process.env.FEMA_TIMEOUT_MS ?? 10_000);
  const top = process.env.FEMA_TOP ?? "100";

  const response = await axios.get<FemaResponse>(endpoint, {
    timeout,
    params: {
      $orderby: "declarationDate desc",
      $top: top,
    },
  });

  return response.data.DisasterDeclarationsSummaries ?? [];
}

export async function ingestFEMA(): Promise<void> {
  try {
    const disasters = await fetchDisasters();

    if (!disasters.length) {
      console.warn("[Ingestion][FEMA] No disaster declarations returned.");
      return;
    }

    const normalizedEvents = disasters.map(normalizeDisaster);
    const clusters = buildRapidClusters(disasters);

    const enrichedEvents = await enrichEventsWithRisk(normalizedEvents);

    await upsertEvents(enrichedEvents);
    await publishMapEvents(enrichedEvents);
    await publishRapidClusters(clusters);

    updateEventsCache(enrichedEvents);
    updateRapidCallsCache(clusters);

    console.log(
      `[Ingestion][FEMA] Processed ${enrichedEvents.length} declarations (persisted, emitted, cached).`
    );
  } catch (error) {
    console.error("[Ingestion][FEMA] Failed to process feed", error);
  }
}
