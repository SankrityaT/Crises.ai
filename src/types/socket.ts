import type { PersistedEvent } from "../../types/events";
import type {
  PredictionSummary,
  RapidCallCluster,
  SocialHotspot,
} from "./map";

export interface MapEventPayload {
  kind: "map.events";
  events: PersistedEvent[];
  emittedAt: string;
}

export interface RapidClusterPayload {
  kind: "map.rapid";
  clusters: RapidCallCluster[];
  emittedAt: string;
}

export interface SocialSentimentPayload {
  kind: "map.social";
  hotspots: SocialHotspot[];
  emittedAt: string;
}

export interface PredictionPayload {
  kind: "map.predictions";
  predictions: PredictionSummary[];
  emittedAt: string;
}

export type SocketPayload =
  | MapEventPayload
  | RapidClusterPayload
  | SocialSentimentPayload
  | PredictionPayload;
