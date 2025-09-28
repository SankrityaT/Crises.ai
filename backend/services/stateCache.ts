import type { PersistedEvent } from "../../types/events";
import type {
  PredictionSummary,
  RapidCallCluster,
  SocialHotspot,
  CustomerDensityRegion,
} from "../../src/types/map";

interface MapState {
  events: PersistedEvent[];
  rapidCalls: RapidCallCluster[];
  socialHotspots: SocialHotspot[];
  predictions: PredictionSummary[];
  customerDensity: CustomerDensityRegion[];
}

const mapState: MapState = {
  events: [],
  rapidCalls: [],
  socialHotspots: [],
  predictions: [],
  customerDensity: [],
};

function dedupeEvents(events: PersistedEvent[]): PersistedEvent[] {
  const seen = new Map<string, PersistedEvent>();

  for (const event of events) {
    seen.set(event.id, event);
  }

  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

export function updateEventsCache(events: PersistedEvent[]): void {
  mapState.events = dedupeEvents([...mapState.events, ...events]);
}

export function replaceEventsCache(events: PersistedEvent[]): void {
  mapState.events = dedupeEvents(events);
}

export function getEventsCache(): PersistedEvent[] {
  return mapState.events;
}

export function updateRapidCallsCache(clusters: RapidCallCluster[]): void {
  mapState.rapidCalls = [...clusters];
}

export function getRapidCallsCache(): RapidCallCluster[] {
  return mapState.rapidCalls;
}

export function updateSocialHotspotsCache(hotspots: SocialHotspot[]): void {
  mapState.socialHotspots = [...hotspots];
}

export function getSocialHotspotsCache(): SocialHotspot[] {
  return mapState.socialHotspots;
}

export function updatePredictionsCache(predictions: PredictionSummary[]): void {
  mapState.predictions = [...predictions];
}

export function getPredictionsCache(): PredictionSummary[] {
  return mapState.predictions;
}

export function updateCustomerDensityCache(
  regions: CustomerDensityRegion[]
): void {
  mapState.customerDensity = [...regions];
}

export function getCustomerDensityCache(): CustomerDensityRegion[] {
  return mapState.customerDensity;
}

export function clearStateCaches(): void {
  mapState.events = [];
  mapState.rapidCalls = [];
  mapState.socialHotspots = [];
  mapState.predictions = [];
  mapState.customerDensity = [];
}
