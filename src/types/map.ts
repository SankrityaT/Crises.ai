export type EventSeverity = "low" | "moderate" | "high" | "critical";

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface EventFeature {
  id: string;
  title: string;
  source: "usgs" | "kontur" | "nasa" | "rapidsos" | "fema" | "social" | "mock";
  type: string;
  severity: EventSeverity;
  magnitude?: number;
  startedAt: string;
  coordinates: Coordinate;
  metadata?: Record<string, unknown>;
}

export interface PredictionSummary {
  id: string;
  label: string;
  expectedClaims: number;
  adjustersNeeded: number;
  generatedAt: string;
}

export interface RapidCallCluster {
  id: string;
  coordinates: Coordinate;
  incidentType: string;
  volume: number;
  lastUpdated: string;
}

export interface SocialHotspot {
  id: string;
  sentimentScore: number;
  mentionCount: number;
  coordinates: Coordinate;
  lastUpdated: string;
}

export interface CustomerDensityRegion {
  id: string;
  regionName: string;
  densityScore: number;
  population?: number;
  geometry: unknown;
}

export interface MapBootstrapPayload {
  events: EventFeature[];
  rapidCalls: RapidCallCluster[];
  socialHotspots: SocialHotspot[];
  predictions: PredictionSummary[];
  customerDensity: CustomerDensityRegion[];
}
