import { readFile } from "node:fs/promises";
import path from "node:path";
import axios from "axios";

import type { NormalizedSocialMention } from "../../types/social";
import type { SocialHotspot } from "../../src/types/map";
import { upsertSocialMentions } from "../services/socialRepository";
import { publishSocialHotspots } from "../services/socketEmitter";
import { updateSocialHotspotsCache } from "../services/stateCache";

// ReliefWeb API - Free humanitarian data
const RELIEFWEB_ENDPOINT = "https://api.reliefweb.int/v1/reports";

interface ReliefWebReport {
  id: string;
  fields: {
    title?: string;
    body?: string;
    date?: {
      created?: string;
    };
    primary_country?: {
      name?: string;
      location?: {
        lat?: number;
        lon?: number;
      };
    }[];
    disaster?: {
      name?: string;
      type?: {
        name?: string;
      }[];
    }[];
    source?: {
      name?: string;
    }[];
  };
}

interface ReliefWebResponse {
  data?: ReliefWebReport[];
}

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockFeed(): Promise<SocialHotspot[]> {
  try {
    const contents = await readFile(resolveMockPath("social-mentions.json"), "utf-8");
    const json = JSON.parse(contents) as { mentions?: Array<{
      id: string;
      sentiment_score: number;
      mention_count?: number;
      latitude?: number;
      longitude?: number;
      captured_at: string;
    }> };

    return (json.mentions || [])
      .filter(mention => mention.latitude != null && mention.longitude != null)
      .map(mention => ({
        id: mention.id,
        sentimentScore: mention.sentiment_score,
        mentionCount: mention.mention_count || 1,
        coordinates: {
          lat: mention.latitude as number,
          lng: mention.longitude as number,
        },
        lastUpdated: mention.captured_at,
      }));
  } catch (error) {
    console.warn("[ReliefWeb] Mock file not found, returning empty array");
    return [];
  }
}

export function extractSentimentFromReport(report: ReliefWebReport): number {
  const title = report.fields.title || "";
  const body = report.fields.body || "";
  const text = (title + " " + body).toLowerCase();
  
  // Simple sentiment analysis based on disaster-related keywords
  const negativeWords = [
    'disaster', 'emergency', 'crisis', 'catastrophe', 'devastation', 'destruction',
    'death', 'killed', 'injured', 'missing', 'evacuated', 'displaced', 'homeless',
    'severe', 'critical', 'urgent', 'desperate', 'tragic', 'terrible', 'horrible'
  ];
  
  const positiveWords = [
    'relief', 'aid', 'help', 'rescue', 'recovery', 'support', 'assistance',
    'restored', 'improved', 'stable', 'safe', 'secure', 'successful'
  ];
  
  let score = 0;
  negativeWords.forEach(word => {
    const matches = (text.match(new RegExp(word, 'g')) || []).length;
    score -= matches * 0.1;
  });
  
  positiveWords.forEach(word => {
    const matches = (text.match(new RegExp(word, 'g')) || []).length;
    score += matches * 0.1;
  });
  
  // Normalize to -1 to 1 range
  return Math.max(-1, Math.min(1, score));
}

export function normalizeReliefWebReport(report: ReliefWebReport): SocialHotspot | null {
  const country = report.fields.primary_country?.[0];
  if (!country?.location?.lat || !country?.location?.lon) {
    return null; // Skip reports without location data
  }

  const sentiment = extractSentimentFromReport(report);
  const disaster = report.fields.disaster?.[0];
  
  return {
    id: `reliefweb_${report.id}`,
    sentimentScore: sentiment,
    mentionCount: 1, // Each report counts as 1 mention
    coordinates: {
      lat: country.location.lat,
      lng: country.location.lon,
    },
    lastUpdated: report.fields.date?.created || new Date().toISOString(),
  } satisfies SocialHotspot;
}

async function fetchReliefWebReports(): Promise<ReliefWebReport[]> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][ReliefWeb] Mock mode enabled. Loading local fixture.");
    return [];
  }

  try {
    // Get recent disaster reports from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const response = await axios.get<ReliefWebResponse>(RELIEFWEB_ENDPOINT, {
      timeout: Number(process.env.RELIEFWEB_TIMEOUT_MS ?? 15_000),
      params: {
        appname: 'crisisai-sunhacks',
        preset: 'latest',
        'filter[field]': 'date.created',
        'filter[value][from]': yesterday.toISOString().split('T')[0],
        'filter[conditions][0][field]': 'disaster',
        'filter[conditions][0][value]': 'exists',
        limit: 50,
        'fields[include]': 'title,body,date.created,primary_country.name,primary_country.location,disaster.name,disaster.type.name,source.name'
      }
    });

    return response.data?.data || [];
  } catch (error) {
    console.warn("[Ingestion][ReliefWeb] Failed to fetch live data, falling back to mock");
    return [];
  }
}

export async function ingestReliefWeb(): Promise<void> {
  try {
    const reports = await fetchReliefWebReports();

    if (!reports.length) {
      console.log("[Ingestion][ReliefWeb] No reports found, using mock data");
      const mockHotspots = await loadMockFeed();
      if (mockHotspots.length) {
        await publishSocialHotspots(mockHotspots);
        updateSocialHotspotsCache(mockHotspots);
        console.log(`[Ingestion][ReliefWeb] Published ${mockHotspots.length} mock social hotspots.`);
      }
      return;
    }

    const hotspots = reports
      .map(normalizeReliefWebReport)
      .filter((hotspot): hotspot is SocialHotspot => Boolean(hotspot));

    if (!hotspots.length) {
      console.warn("[Ingestion][ReliefWeb] No valid hotspots after normalization.");
      return;
    }

    // Convert to social mentions for database storage
    const mentions: NormalizedSocialMention[] = hotspots.map(hotspot => ({
      id: hotspot.id,
      platform: "reliefweb",
      content: `Humanitarian report from ${hotspot.coordinates.lat.toFixed(2)}, ${hotspot.coordinates.lng.toFixed(2)}`,
      sentimentScore: hotspot.sentimentScore,
      location: {
        latitude: hotspot.coordinates.lat,
        longitude: hotspot.coordinates.lng,
      },
      capturedAt: hotspot.lastUpdated,
      raw: { source: "reliefweb" },
    }));

    await upsertSocialMentions(mentions);
    await publishSocialHotspots(hotspots);
    updateSocialHotspotsCache(hotspots);

    console.log(
      `[Ingestion][ReliefWeb] Processed ${hotspots.length} humanitarian reports (persisted + emitted).`
    );
  } catch (error) {
    console.error("[Ingestion][ReliefWeb] Failed to process feed", error);
  }
}
