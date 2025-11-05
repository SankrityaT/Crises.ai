import { NextResponse } from "next/server";
import { AI_RATE_LIMITS } from "@/config/ai-rate-limits";

import type {
  SentimentAnalysisResponse,
  SentimentInsight,
  SocialMentionPayload,
} from "@/types/ai";

// CRITICAL: Server-side cache to prevent redundant AI calls
const responseCache = new Map<string, { response: SentimentAnalysisResponse; timestamp: number }>();

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_ENDPOINT = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`;

interface SentimentRequestBody {
  mentions: SocialMentionPayload[];
}

function summarizeMentions(mentions: SocialMentionPayload[]): string {
  const preview = mentions
    .slice(0, 5)
    .map((mention) => ({
      postId: mention.postId,
      platform: mention.platform,
      text: mention.text,
      location: mention.location,
      timestamp: mention.timestamp,
    }));

  return JSON.stringify({
    mentionCount: mentions.length,
    sample: preview,
  });
}

function buildPrompt(mentions: SocialMentionPayload[]): string {
  return `You are CrisisLens AI aggregating real-time social chatter for State Farm.
You will receive a JSON array named mentions.

SYSTEM DIRECTIVES:
- Output strictly valid JSON matching this schema:
  {
    "generatedAt": ISO8601 UTC string,
    "model": string,
    "overallSentiment": "positive" | "neutral" | "negative",
    "panicLevel": "low" | "moderate" | "high",
    "hotspots": [
      { "lat": number, "lng": number, "panicIndex": number (0–1), "mentions": number }
    ],
    "insights": [
      {
        "postId": string,
        "platform": string,
        "sentimentLabel": "positive" | "neutral" | "negative",
        "panicScore": number (0–1),
        "summary": string  // no more than 30 words, factual
      }
    ]
  }
- Compute panicLevel from the average panicScore:
  * ≥ 0.7 → "high"
  * 0.4–0.69 → "moderate"
  * < 0.4 → "low"
- Hotspots should aggregate geo-tagged mentions (average lat/lng, mean panicScore).
- Omit hotspots array or leave it empty if no locations exist.
- Cover at least min(mentions.length, 5) insights.
- Never speculate or invent events beyond supplied text.
- If metadata includes official_incident_type or source_confidence, prioritize those details when summarizing.
- Recognize mentions with 'verified: true' (if provided) and weight their panicScore 20% higher than unverified posts.
- When posts conflict (e.g., one claims "safe" while another claims "panic"), highlight the discrepancy in summaries and dampen overall panicLevel.
- Use repeated location clusters to raise panicIndex; isolated single-mention hotspots should cap panicIndex at 0.4.
- If mentions reference rumors or uncertain language, append "(unverified)" in the summary.

MENTIONS:
${JSON.stringify(mentions, null, 2)}

MENTIONS SUMMARY:
${summarizeMentions(mentions)}`;
}

async function callGemini(prompt: string): Promise<SentimentAnalysisResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} ${detail}`);
  }

  const json = await response.json();
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof content !== "string") {
    throw new Error("Gemini API returned unexpected payload");
  }

  try {
    const parsed = JSON.parse(content) as SentimentAnalysisResponse;
    // Basic structural validation to surface issues early
    if (!Array.isArray(parsed.insights) || !Array.isArray(parsed.hotspots)) {
      throw new Error("Missing insights or hotspots array");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse Gemini response: ${(error as Error).message}`);
  }
}

export async function POST(request: Request) {
  let body: SentimentRequestBody;
  try {
    body = (await request.json()) as SentimentRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mentions || !Array.isArray(body.mentions) || body.mentions.length === 0) {
    return NextResponse.json(
      { error: "Invalid payload: non-empty mentions array is required" },
      { status: 400 },
    );
  }

  // Generate cache key from mention IDs
  const cacheKey = body.mentions
    .map(m => `${m.postId}-${m.platform}`)
    .sort()
    .join('|');
  
  // Check cache first
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AI_RATE_LIMITS.CACHE_TTL) {
    console.log('[API][AI] Returning cached sentiment response');
    return NextResponse.json(cached.response, { status: 200 });
  }

  try {
    const prompt = buildPrompt(body.mentions);
    const summary = await callGemini(prompt);
    
    // Cache the response
    responseCache.set(cacheKey, { response: summary, timestamp: Date.now() });
    
    // Clean old cache entries
    if (responseCache.size > AI_RATE_LIMITS.MAX_CACHE_SIZE) {
      const now = Date.now();
      for (const [key, value] of responseCache.entries()) {
        if (now - value.timestamp > AI_RATE_LIMITS.CACHE_TTL) {
          responseCache.delete(key);
        }
      }
    }
    
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("[API][AI] Gemini sentiment failure", error);
    return NextResponse.json({ error: "Gemini service unavailable" }, { status: 502 });
  }
}
