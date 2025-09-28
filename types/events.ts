export type EventSource =
  | "usgs"
  | "kontur"
  | "nasa"
  | "fema"
  | "social"
  | "sffd"
  | "mock";

export interface NormalizedEvent {
  id: string;
  title: string;
  source: EventSource;
  description?: string;
  coordinates: {
    latitude: number;
    longitude: number;
    depth?: number | null;
  };
  magnitude?: number | null;
  severity?: "low" | "moderate" | "high" | "critical";
  occurredAt: string;
  raw?: unknown;
}

export interface PersistedEvent extends NormalizedEvent {
  riskScore?: number | null;
  customerDensityId?: string | null;
}

export interface RiskFactorBreakdown {
  magnitudeWeight: number;
  densityWeight: number;
  recencyWeight: number;
}

export interface RiskScoreResult {
  eventId: string;
  riskScore: number;
  level: "low" | "moderate" | "high" | "critical";
  factors: RiskFactorBreakdown;
  customerDensityId?: string | null;
}
