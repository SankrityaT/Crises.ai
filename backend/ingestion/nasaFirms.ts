import { readFile } from "node:fs/promises";
import path from "node:path";

import axios from "axios";
import Papa from "papaparse";

import type { NormalizedEvent } from "../../types/events";
import { enrichEventsWithRisk } from "../services/riskScore";
import { upsertEvents } from "../services/eventRepository";
import { publishMapEvents } from "../services/socketEmitter";
import { updateEventsCache } from "../services/stateCache";

const DEFAULT_NASA_ENDPOINT =
  "https://firms.modaps.eosdis.nasa.gov/api/area/csv";

export interface NasaFireRecord {
  id: string;
  brightness: number;
  latitude: number;
  longitude: number;
  acq_date: string;
  acq_time: string;
  confidence?: string;
}

export interface NasaResponse {
  fires?: NasaFireRecord[];
}

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockFeed(): Promise<NasaResponse> {
  const contents = await readFile(resolveMockPath("nasa-firms.json"), "utf-8");
  return JSON.parse(contents) as NasaResponse;
}

function createFireRecord(
  row: Record<string, unknown>,
  index: number
): NasaFireRecord | null {
  const latitude = Number(row.latitude ?? row.lat ?? row.Latitude);
  const longitude = Number(row.longitude ?? row.lon ?? row.Longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const acqDate = String(
    row.acq_date ?? row.date ?? new Date().toISOString().slice(0, 10)
  );
  const rawAcqTime = String(row.acq_time ?? row.time ?? "0000");
  const acqTime = rawAcqTime.padStart(4, "0").slice(0, 4);

  const brightnessCandidate = Number(
    row.bright_ti4 ?? row.brightness ?? row.bright_ti5 ?? row.frp ?? 0
  );
  const brightness = Number.isFinite(brightnessCandidate)
    ? brightnessCandidate
    : 0;

  const id = String(
    row.id ??
      row.fire_id ??
      row.unique_id ??
      `${acqDate}-${acqTime}-${latitude}-${longitude}-${index}`
  );

  return {
    id,
    brightness,
    latitude,
    longitude,
    acq_date: acqDate,
    acq_time: acqTime,
    confidence: row.confidence
      ? String(row.confidence)
      : row.confidence_ti4
      ? String(row.confidence_ti4)
      : row.confidence_ti5
      ? String(row.confidence_ti5)
      : undefined,
  } satisfies NasaFireRecord;
}

export function deriveSeverity(fire: NasaFireRecord): NormalizedEvent["severity"] {
  if (fire.brightness >= 340) return "critical";
  if (fire.brightness >= 310) return "high";
  if (fire.brightness >= 280) return "moderate";
  return "low";
}

export function normalizeFire(fire: NasaFireRecord): NormalizedEvent {
  const occurredAt = new Date(`${fire.acq_date}T${(fire.acq_time ?? "0000").padStart(4, "0").slice(0, 2)}:${
    (fire.acq_time ?? "0000").padStart(4, "0").slice(2, 4)
  }:00Z`).toISOString();

  return {
    id: fire.id,
    title: `Wildfire detection (${fire.confidence ?? "unknown"} confidence)`,
    description: `Thermal anomaly detected with brightness ${fire.brightness}`,
    source: "nasa",
    coordinates: {
      latitude: fire.latitude,
      longitude: fire.longitude,
    },
    magnitude: fire.brightness,
    severity: deriveSeverity(fire),
    occurredAt,
    raw: fire,
  } satisfies NormalizedEvent;
}

async function fetchFires(): Promise<NasaResponse> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][NASA] Mock mode enabled. Loading local fixture.");
    return loadMockFeed();
  }

  const endpoint = process.env.NASA_FIRMS_API_URL ?? DEFAULT_NASA_ENDPOINT;
  const apiKey = process.env.NASA_FIRMS_API_KEY;

  const params: Record<string, string> | undefined =
    apiKey && !endpoint.includes(apiKey) ? { api_key: apiKey } : undefined;

  const response = await axios.get<string | Record<string, unknown>>(endpoint, {
    timeout: Number(process.env.NASA_FIRMS_TIMEOUT_MS ?? 10_000),
    params,
    responseType: "text",
    transformResponse: (res) => res,
  });

  const rawData = response.data;

  if (typeof rawData === "string") {
    try {
      const parsedJson = JSON.parse(rawData) as unknown;

      if (Array.isArray(parsedJson)) {
        const fires = parsedJson
          .map((row, index) =>
            createFireRecord(row as Record<string, unknown>, index)
          )
          .filter((record): record is NasaFireRecord => Boolean(record));

        return { fires } satisfies NasaResponse;
      }

      if (
        parsedJson &&
        typeof parsedJson === "object" &&
        "fires" in (parsedJson as Record<string, unknown>)
      ) {
        const fireArray =
          (parsedJson as { fires?: Array<Record<string, unknown>> }).fires ?? [];

        const fires = fireArray
          .map((row, index) => createFireRecord(row, index))
          .filter((record): record is NasaFireRecord => Boolean(record));

        return { fires } satisfies NasaResponse;
      }
    } catch (error) {
      // not JSON, continue to CSV parsing
    }

    const parsedCsv = Papa.parse<Record<string, unknown>>(rawData, {
      header: true,
      skipEmptyLines: true,
    });

    const fires = parsedCsv.data
      .map((row: Record<string, unknown>, index: number) =>
        createFireRecord(row, index)
      )
      .filter((record): record is NasaFireRecord => Boolean(record));

    return { fires } satisfies NasaResponse;
  }

  if (rawData && typeof rawData === "object") {
    const fireArray = Array.isArray(rawData)
      ? rawData
      : (rawData as { fires?: Array<Record<string, unknown>> }).fires ?? [];

    const fires = fireArray
      .map((row, index) =>
        createFireRecord(row as Record<string, unknown>, index)
      )
      .filter((record): record is NasaFireRecord => Boolean(record));

    return { fires } satisfies NasaResponse;
  }

  console.warn("[Ingestion][NASA] Unable to parse response. Skipping run.");
  return { fires: [] } satisfies NasaResponse;
}

export async function ingestNasaFirms(): Promise<void> {
  try {
    const payload = await fetchFires();

    if (!payload.fires?.length) {
      console.warn("[Ingestion][NASA] Response contained no fire records.");
      return;
    }

    const normalized = payload.fires.map(normalizeFire);
    const enriched = await enrichEventsWithRisk(normalized);

    await upsertEvents(enriched);
    await publishMapEvents(enriched);
    updateEventsCache(enriched);

    console.log(
      `[Ingestion][NASA] Processed ${enriched.length} fire detections (persisted + emitted).`
    );
  } catch (error) {
    console.error("[Ingestion][NASA] Failed to process feed", error);
  }
}
