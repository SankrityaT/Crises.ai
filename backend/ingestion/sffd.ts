import { readFile } from "node:fs/promises";
import path from "node:path";
import axios from "axios";

import type { NormalizedEvent } from "../../types/events";
import { enrichEventsWithRisk } from "../services/riskScore";
import { upsertEvents } from "../services/eventRepository";
import { publishMapEvents } from "../services/socketEmitter";
import { updateEventsCache } from "../services/stateCache";

// San Francisco Fire Department Calls for Service API
const SFFD_ENDPOINT = "https://data.sfgov.org/resource/nuek-vuh3.json";

interface SFFDCall {
  call_number?: string;
  unit_id?: string;
  incident_number?: string;
  call_type?: string;
  call_date?: string;
  watch_date?: string;
  call_final_disposition?: string;
  available_dttm?: string;
  address?: string;
  city?: string;
  zipcode_of_incident?: string;
  battalion?: string;
  station_area?: string;
  box?: string;
  original_priority?: string;
  priority?: string;
  final_priority?: string;
  als_unit?: boolean;
  call_type_group?: string;
  number_of_alarms?: string;
  unit_type?: string;
  unit_sequence_in_call_dispatch?: string;
  fire_prevention_district?: string;
  supervisor_district?: string;
  neighborhood_district?: string;
  location?: {
    latitude?: string;
    longitude?: string;
  };
  point?: {
    coordinates?: [number, number];
  };
}

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockFeed(): Promise<SFFDCall[]> {
  const filePath = resolveMockPath("sffd-calls.json");
  try {
    const contents = await readFile(filePath, "utf-8");
    return JSON.parse(contents) as SFFDCall[];
  } catch (error) {
    console.warn("[SFFD] Mock file not found, returning empty array");
    return [];
  }
}

export function severityFromCallType(callType?: string): NormalizedEvent["severity"] {
  if (!callType) return "moderate";
  
  const type = callType.toLowerCase();
  
  if (type.includes("structure fire") || type.includes("working fire") || type.includes("explosion")) {
    return "critical";
  }
  if (type.includes("fire") || type.includes("rescue") || type.includes("hazmat")) {
    return "high";
  }
  if (type.includes("medical") || type.includes("traffic") || type.includes("alarm")) {
    return "moderate";
  }
  
  return "low";
}

export function normalizeCall(call: SFFDCall): NormalizedEvent | null {
  if (!call.call_number || !call.call_type) {
    return null;
  }

  // Extract coordinates
  let latitude: number | undefined;
  let longitude: number | undefined;

  if (call.point?.coordinates) {
    [longitude, latitude] = call.point.coordinates;
  } else if (call.location?.latitude && call.location?.longitude) {
    latitude = parseFloat(call.location.latitude);
    longitude = parseFloat(call.location.longitude);
  }

  if (!latitude || !longitude) {
    return null; // Skip calls without location
  }

  const occurredAt = call.call_date 
    ? new Date(call.call_date).toISOString()
    : new Date().toISOString();

  return {
    id: `sffd_${call.call_number}`,
    title: `${call.call_type} - ${call.address || 'San Francisco'}`,
    description: `${call.call_type} in ${call.neighborhood_district || 'San Francisco'}`,
    source: "sffd",
    coordinates: {
      latitude,
      longitude,
      depth: null,
    },
    magnitude: call.number_of_alarms ? parseInt(call.number_of_alarms) : null,
    severity: severityFromCallType(call.call_type),
    occurredAt,
    raw: call,
  } satisfies NormalizedEvent;
}

async function fetchFeed(): Promise<SFFDCall[]> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][SFFD] Mock mode enabled. Loading local fixture.");
    return loadMockFeed();
  }

  try {
    // Get recent calls from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const whereClause = `call_date >= '${yesterday.toISOString().split('T')[0]}'`;
    
    const response = await axios.get<SFFDCall[]>(SFFD_ENDPOINT, {
      timeout: Number(process.env.SFFD_TIMEOUT_MS ?? 15_000),
      params: {
        $where: whereClause,
        $limit: 500,
        $order: "call_date DESC"
      }
    });

    return response.data || [];
  } catch (error) {
    console.warn("[Ingestion][SFFD] Failed to fetch live data, falling back to mock");
    return loadMockFeed();
  }
}

export async function ingestSFFD(): Promise<void> {
  try {
    const calls = await fetchFeed();

    if (!calls.length) {
      console.warn("[Ingestion][SFFD] Feed returned no calls.");
      return;
    }

    const normalized = calls
      .map(normalizeCall)
      .filter((call): call is NormalizedEvent => Boolean(call));

    if (!normalized.length) {
      console.warn("[Ingestion][SFFD] Normalized call list empty after filtering.");
      return;
    }

    const enriched = await enrichEventsWithRisk(normalized);

    await upsertEvents(enriched);
    await publishMapEvents(enriched);
    updateEventsCache(enriched);

    console.log(
      `[Ingestion][SFFD] Processed ${enriched.length} calls (persisted + emitted).`
    );
  } catch (error) {
    console.error("[Ingestion][SFFD] Failed to process feed", error);
  }
}
