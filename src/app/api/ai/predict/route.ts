import { NextResponse } from "next/server";
import { AI_RATE_LIMITS } from "@/config/ai-rate-limits";

import type {
  ClaimForecastInsight,
  ClaimForecastResponse,
  DisasterEventContext,
} from "@/types/ai";

// CRITICAL: Server-side cache to prevent redundant AI calls
const responseCache = new Map<string, { response: ClaimForecastResponse; timestamp: number }>();

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_ENDPOINT = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`;

interface PredictRequestBody {
  events: DisasterEventContext[];
}

function buildPrompt(events: DisasterEventContext[]): string {
  return `You are CrisisLens AI supporting State Farm catastrophe response.
You receive the following JSON array called events.

SYSTEM DIRECTIVES:
- Respond **only** with valid JSON that conforms to this schema:
  {
    "generatedAt": ISO8601 UTC string,
    "model": string,
    "insights": [
      {
        "eventId": string,
        "summary": string,
        "expectedClaimsRange": string,     // e.g. "800-1.1k"
        "adjusterRecommendation": string,  // concrete staffing plan with timing
        "riskDrivers": string[]            // 2–4 bullet phrases
      }
    ]
  }
- Summaries must be factual and derived strictly from the provided event fields.
- expectedClaimsRange should be a conservative numeric range (thousands use “k” suffix).
- adjusterRecommendation must include headcount plus time horizon (e.g. “Deploy 35 adjusters within 12 hours”).
- riskDrivers must highlight key drivers such as severity, population density, metadata signals, etc.
- If information is missing, state “insufficient data” rather than guessing.
- Do not include commentary outside the JSON envelope.
- When metadata contains rapid_call_volume, historic_claim_index, or resource_constraints, explicitly reference them in the summary, range, and recommendation.
- Treat high rapid_call_volume (> historical average) as justification for the upper bound of claims and additional adjusters.
- If resource_constraints indicate limited adjusters, recommend staging or staggered deployments rather than exceeding capacity.
- Use hazardType and magnitude to differentiate between structural and contents losses when framing recommendations.

EVENT CONTEXTS:
${JSON.stringify(events, null, 2)}`;
}

function formatClaimValue(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}M`;
  }
  return `${Math.round(value)}k`;
}

function buildFallbackInsights(events: DisasterEventContext[]): ClaimForecastInsight[] {
  return events.map((event, index) => {
    const severity = Math.max(1, Math.min(4, Number.isFinite(event.severity) ? event.severity : 2));
    const magnitude = Number.isFinite(event.magnitude) ? (event.magnitude ?? 0) : 0;
    const density = Number.isFinite(event.customerDensity) ? event.customerDensity : 0;

    const baseScore = severity * 8 + magnitude * 4 + density * 0.4;
    const lowerBound = Math.max(15, baseScore * 0.6);
    const upperBound = Math.max(lowerBound + 10, baseScore * 0.95);

    const expectedClaimsRange = `${formatClaimValue(lowerBound)}-${formatClaimValue(upperBound)}`;
    const adjustersNeeded = Math.max(1, Math.round(severity * 1.5));
    const coordinateSummary = `${event.location.lat.toFixed(2)}, ${event.location.lng.toFixed(2)}`;

    const summary = `Severity index ${severity} ${event.hazardType} requiring monitoring near ${coordinateSummary}.`;
    const adjusterRecommendation = `Deploy ${adjustersNeeded} adjusters within 12 hours.`;
    const riskDrivers = [
      `Severity index ${severity}`,
      `Magnitude ${magnitude.toFixed(1)}`,
      `Exposure score ${Math.round(density)}`,
    ];

    return {
      eventId: event.eventId ?? `event_${index + 1}`,
      summary,
      expectedClaimsRange,
      adjusterRecommendation,
      riskDrivers,
    } satisfies ClaimForecastInsight;
  });
}

function buildFallbackResponse(events: DisasterEventContext[]): ClaimForecastResponse {
  return {
    generatedAt: new Date().toISOString(),
    model: "crises-fallback-heuristic",
    insights: buildFallbackInsights(events),
  } satisfies ClaimForecastResponse;
}

async function callGemini(prompt: string): Promise<ClaimForecastResponse> {
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
          role: "user",
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
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} model=${GEMINI_MODEL} ${detail}`,
    );
  }

  const json = await response.json();
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof content !== "string") {
    throw new Error("Gemini API returned unexpected payload");
  }

  try {
    const parsed = JSON.parse(content) as ClaimForecastResponse;
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse Gemini response: ${(error as Error).message}`);
  }
}

export async function POST(request: Request) {
  let body: PredictRequestBody;
  try {
    body = (await request.json()) as PredictRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json(
      { error: "Invalid payload: non-empty events array is required" },
      { status: 400 },
    );
  }

  // Generate cache key from event IDs and severities
  const cacheKey = body.events
    .map(e => `${e.eventId}-${e.severity}-${e.magnitude}`)
    .sort()
    .join('|');
  
  // Check cache first
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AI_RATE_LIMITS.CACHE_TTL) {
    console.log('[API][AI] Returning cached prediction response');
    return NextResponse.json(cached.response, { status: 200 });
  }

  try {
    const prompt = buildPrompt(body.events);
    const apiKeyPresent = Boolean(process.env.GEMINI_API_KEY);

    if (!apiKeyPresent) {
      const fallback = buildFallbackResponse(body.events);
      return NextResponse.json(fallback, { status: 200 });
    }

    try {
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
      console.error("[API][AI] Gemini call failed, using fallback", error);
      const fallback = buildFallbackResponse(body.events);
      responseCache.set(cacheKey, { response: fallback, timestamp: Date.now() });
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (error) {
    console.error("[API][AI] Gemini claim forecast failure", error);
    const fallback = buildFallbackResponse(body.events);
    return NextResponse.json(fallback, { status: 200 });
  }
}
