import { NextResponse } from "next/server";

import type { ClaimForecastResponse, DisasterEventContext } from "@/types/ai";

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

  try {
    const prompt = buildPrompt(body.events);
    const summary = await callGemini(prompt);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("[API][AI] Gemini claim forecast failure", error);
    return NextResponse.json({ error: "Gemini service unavailable" }, { status: 502 });
  }
}
