import { readFile } from "node:fs/promises";
import path from "node:path";

import axios from "axios";

import type { NormalizedEvent } from "../../types/events";
import type { NormalizedSocialMention } from "../../types/social";
import type { SocialHotspot } from "../../src/types/map";
import { enrichEventsWithRisk } from "../services/riskScore";
import { upsertEvents } from "../services/eventRepository";
import { upsertSocialMentions } from "../services/socialRepository";
import {
  publishMapEvents,
  publishSocialHotspots,
} from "../services/socketEmitter";
import {
  updateEventsCache,
  updateSocialHotspotsCache,
} from "../services/stateCache";

const DEFAULT_SOCIAL_ENDPOINT = "https://api.social-monitor.local/mentions";

export interface SocialMentionRecord {
  id: string;
  platform: string;
  content: string;
  sentiment_score: number;
  mention_count?: number;
  latitude?: number;
  longitude?: number;
  captured_at: string;
}

export interface SocialResponse {
  mentions?: SocialMentionRecord[];
}

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockFeed(): Promise<SocialResponse> {
  const contents = await readFile(resolveMockPath("social-mentions.json"), "utf-8");
  return JSON.parse(contents) as SocialResponse;
}

export function sentimentToSeverity(sentiment: number): NormalizedEvent["severity"] {
  if (sentiment <= -0.6) return "critical";
  if (sentiment <= -0.3) return "high";
  if (sentiment >= 0.4) return "low";
  return "moderate";
}

export function normalizeMention(record: SocialMentionRecord): NormalizedSocialMention {
  return {
    id: record.id,
    platform: record.platform,
    content: record.content,
    sentimentScore: record.sentiment_score,
    mentionCount: record.mention_count,
    coordinates:
      record.latitude != null && record.longitude != null
        ? { latitude: record.latitude, longitude: record.longitude }
        : null,
    capturedAt: new Date(record.captured_at).toISOString(),
    metadata: {
      source: "social",
    },
  } satisfies NormalizedSocialMention;
}

export function mentionToEvent(
  mention: NormalizedSocialMention
): NormalizedEvent | null {
  if (!mention.coordinates) {
    return null;
  }

  return {
    id: `social_${mention.id}`,
    title: `Social chatter - ${mention.platform}`,
    description: mention.content,
    source: "social",
    coordinates: {
      latitude: mention.coordinates.latitude,
      longitude: mention.coordinates.longitude,
    },
    severity: sentimentToSeverity(mention.sentimentScore),
    occurredAt: mention.capturedAt,
    raw: mention,
  } satisfies NormalizedEvent;
}

export function toHotspot(mention: NormalizedSocialMention): SocialHotspot {
  return {
    id: mention.id,
    sentimentScore: mention.sentimentScore,
    mentionCount: mention.mentionCount ?? 0,
    coordinates: {
      lat: mention.coordinates?.latitude ?? 0,
      lng: mention.coordinates?.longitude ?? 0,
    },
    lastUpdated: mention.capturedAt,
  } satisfies SocialHotspot;
}

async function fetchMentions(): Promise<SocialResponse> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][Social] Mock mode enabled. Loading local fixture.");
    return loadMockFeed();
  }

  const endpoint = process.env.SOCIAL_MENTIONS_API_URL ?? DEFAULT_SOCIAL_ENDPOINT;
  const token = process.env.SOCIAL_MENTIONS_TOKEN;

  if (!process.env.SOCIAL_MENTIONS_API_URL || !token) {
    console.warn(
      "[Ingestion][Social] Missing SOCIAL_MENTIONS_API_URL or SOCIAL_MENTIONS_TOKEN. Skipping live fetch."
    );
    return { mentions: [] };
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await axios.get<SocialResponse>(endpoint, {
    timeout: Number(process.env.SOCIAL_MENTIONS_TIMEOUT_MS ?? 10_000),
    headers,
  });

  return response.data ?? {};
}

export async function ingestSocial(): Promise<void> {
  try {
    const payload = await fetchMentions();

    if (!payload.mentions?.length) {
      console.warn("[Ingestion][Social] No mentions returned from feed.");
      return;
    }

    const normalizedMentions = payload.mentions.map(normalizeMention);
    const events = normalizedMentions
      .map(mentionToEvent)
      .filter((event): event is NormalizedEvent => Boolean(event));
    const hotspots = normalizedMentions
      .filter((mention) => mention.coordinates)
      .map(toHotspot);

    const enrichedEvents = await enrichEventsWithRisk(events);

    await upsertEvents(enrichedEvents);
    await upsertSocialMentions(normalizedMentions);

    await publishMapEvents(enrichedEvents);
    if (hotspots.length) {
      await publishSocialHotspots(hotspots);
      updateSocialHotspotsCache(hotspots);
    }

    updateEventsCache(enrichedEvents);

    console.log(
      `[Ingestion][Social] Processed ${normalizedMentions.length} mentions (persisted + emitted).`
    );
  } catch (error) {
    console.error("[Ingestion][Social] Failed to process feed", error);
  }
}
