export type EventSeverity = "low" | "moderate" | "high" | "critical";

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface EventFeature {
  id: string;
  title: string;
  source: "usgs" | "kontur" | "nasa" | "rapidsos" | "social" | "mock";
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

export interface MapBootstrapPayload {
  events: EventFeature[];
  rapidCalls: RapidCallCluster[];
  socialHotspots: SocialHotspot[];
  predictions: PredictionSummary[];
}

export interface MapFilters {
  showEvents: boolean;
  showRapidCalls: boolean;
  showSocialHotspots: boolean;
  showCustomerDensity: boolean;
  severityThreshold: EventSeverity;
}

export interface CustomerDensityRegion {
  id: string;
  coordinates: Coordinate[];
  customerCount: number;
  riskProfile: "low" | "medium" | "high";
}

export interface MapState {
  events: EventFeature[];
  rapidCalls: RapidCallCluster[];
  socialHotspots: SocialHotspot[];
  predictions: PredictionSummary[];
  customerDensity: CustomerDensityRegion[];
  filters: MapFilters;
  isLoading: boolean;
  lastUpdated: string | null;
}

export interface WebSocketPayload {
  type: "event_update" | "rapid_call_update" | "social_update" | "prediction_update";
  data: EventFeature | RapidCallCluster | SocialHotspot | PredictionSummary;
}
