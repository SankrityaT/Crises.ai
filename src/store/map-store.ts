import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { 
  MapState, 
  EventFeature, 
  RapidCallCluster, 
  SocialHotspot, 
  PredictionSummary,
  CustomerDensityRegion,
  MapFilters,
  EventSeverity 
} from "@/types/map";

const ADJUSTER_CLAIM_CAPACITY = 800;
const MIN_BASELINE_MULTIPLIER = 0.5;
const MAX_BASELINE_MULTIPLIER = 1.1;
const FALLBACK_DOWNSCALE = 20;
const CLAIM_TOTAL_CAP = 100_000;

function normalizeExpectedClaims(
  rawValue: unknown,
  adjustersNeeded: number
): number {
  const numericAdjusters = Number.isFinite(adjustersNeeded)
    ? Math.max(0, Math.round(adjustersNeeded))
    : 0;

  const baseline = numericAdjusters * ADJUSTER_CLAIM_CAPACITY;
  const raw = Number(rawValue);
  const hasRaw = Number.isFinite(raw) && raw > 0;
  let normalized = hasRaw ? raw : baseline;

  if (baseline > 0) {
    const lowerBound = baseline * MIN_BASELINE_MULTIPLIER;
    const upperBound = baseline * MAX_BASELINE_MULTIPLIER;
    normalized = Math.min(Math.max(normalized, lowerBound), upperBound);
  } else if (hasRaw && raw > 0) {
    normalized = raw > 500_000 ? raw / FALLBACK_DOWNSCALE : raw;
  }

  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0;
  }

  return Math.round(normalized);
}

function normalizeAdjusters(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric);
}

function normalizePredictionSummary(
  prediction: PredictionSummary
): PredictionSummary {
  const safeAdjusters = normalizeAdjusters(prediction.adjustersNeeded);
  const expectedClaims = normalizeExpectedClaims(
    prediction.expectedClaims,
    safeAdjusters
  );

  return {
    ...prediction,
    expectedClaims,
    adjustersNeeded: safeAdjusters,
  };
}

function applyClaimsCap(
  predictions: PredictionSummary[]
): PredictionSummary[] {
  const total = predictions.reduce((sum, prediction) => sum + prediction.expectedClaims, 0);

  if (total <= CLAIM_TOTAL_CAP || total === 0) {
    return predictions;
  }

  const scale = CLAIM_TOTAL_CAP / total;
  let scaledTotal = 0;
  const scaled = predictions.map((prediction) => {
    const scaledClaims = Math.max(0, Math.round(prediction.expectedClaims * scale));
    scaledTotal += scaledClaims;
    return {
      ...prediction,
      expectedClaims: scaledClaims,
    };
  });

  if (scaledTotal <= CLAIM_TOTAL_CAP) {
    return scaled;
  }

  let overflow = scaledTotal - CLAIM_TOTAL_CAP;
  if (overflow === 0) {
    return scaled;
  }

  const indexed = scaled.map((prediction, index) => ({ prediction, index }));
  indexed.sort((a, b) => b.prediction.expectedClaims - a.prediction.expectedClaims);

  for (const entry of indexed) {
    if (overflow <= 0) {
      break;
    }

    if (entry.prediction.expectedClaims === 0) {
      continue;
    }

    const deduction = Math.min(overflow, entry.prediction.expectedClaims);
    entry.prediction = {
      ...entry.prediction,
      expectedClaims: entry.prediction.expectedClaims - deduction,
    };
    overflow -= deduction;
  }

  indexed.sort((a, b) => a.index - b.index);
  return indexed.map((entry) => entry.prediction);
}

interface MapStore extends MapState {
  // Connection status
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
  
  // Map view state
  mapCenter: [number, number];
  mapZoom: number;
  setMapView: (center: [number, number], zoom: number) => void;
  
  // Actions
  setEvents: (events: EventFeature[]) => void;
  addEvent: (event: EventFeature) => void;
  updateEvent: (id: string, event: Partial<EventFeature>) => void;
  
  setRapidCalls: (calls: RapidCallCluster[]) => void;
  addRapidCall: (call: RapidCallCluster) => void;
  updateRapidCall: (id: string, call: Partial<RapidCallCluster>) => void;
  
  setSocialHotspots: (hotspots: SocialHotspot[]) => void;
  addSocialHotspot: (hotspot: SocialHotspot) => void;
  updateSocialHotspot: (id: string, hotspot: Partial<SocialHotspot>) => void;
  
  setPredictions: (predictions: PredictionSummary[]) => void;
  addPrediction: (prediction: PredictionSummary) => void;
  
  setCustomerDensity: (regions: CustomerDensityRegion[]) => void;
  
  updateFilters: (filters: Partial<MapFilters>) => void;
  toggleLayer: (layer: keyof Omit<MapFilters, 'severityThreshold'>) => void;
  setSeverityThreshold: (severity: EventSeverity) => void;
  
  setLoading: (loading: boolean) => void;
  setLastUpdated: (timestamp: string) => void;
  
  // Computed getters
  getFilteredEvents: () => EventFeature[];
  getTotalPredictedClaims: () => number;
  getTotalAdjustersNeeded: () => number;
}

const initialFilters: MapFilters = {
  showEvents: true,
  showRapidCalls: true,
  showSocialHotspots: true,
  showCustomerDensity: true,
  severityThreshold: "low"
};

export const useMapStore = create<MapStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    events: [],
    rapidCalls: [],
    socialHotspots: [],
    predictions: [],
    customerDensity: [],
    filters: initialFilters,
    isLoading: false,
    lastUpdated: null,
    connectionStatus: 'disconnected' as const,
    mapCenter: [37.7749, -122.4194] as [number, number], // Default to San Francisco
    mapZoom: 10,

    // Event actions
    setEvents: (events) => set({ events, lastUpdated: new Date().toISOString() }),
    addEvent: (event) => set((state) => ({ 
      events: [...state.events, event],
      lastUpdated: new Date().toISOString()
    })),
    updateEvent: (id, eventUpdate) => set((state) => ({
      events: state.events.map(event => 
        event.id === id ? { ...event, ...eventUpdate } : event
      ),
      lastUpdated: new Date().toISOString()
    })),

    // Rapid calls actions
    setRapidCalls: (rapidCalls) => set({ rapidCalls, lastUpdated: new Date().toISOString() }),
    addRapidCall: (call) => set((state) => ({ 
      rapidCalls: [...state.rapidCalls, call],
      lastUpdated: new Date().toISOString()
    })),
    updateRapidCall: (id, callUpdate) => set((state) => ({
      rapidCalls: state.rapidCalls.map(call => 
        call.id === id ? { ...call, ...callUpdate } : call
      ),
      lastUpdated: new Date().toISOString()
    })),

    // Social hotspots actions
    setSocialHotspots: (socialHotspots) => set({ socialHotspots, lastUpdated: new Date().toISOString() }),
    addSocialHotspot: (hotspot) => set((state) => ({ 
      socialHotspots: [...state.socialHotspots, hotspot],
      lastUpdated: new Date().toISOString()
    })),
    updateSocialHotspot: (id, hotspotUpdate) => set((state) => ({
      socialHotspots: state.socialHotspots.map(hotspot => 
        hotspot.id === id ? { ...hotspot, ...hotspotUpdate } : hotspot
      ),
      lastUpdated: new Date().toISOString()
    })),

    // Predictions actions
    setPredictions: (predictions) => {
      const normalized = predictions.map(normalizePredictionSummary);
      return set({
        predictions: applyClaimsCap(normalized),
        lastUpdated: new Date().toISOString()
      });
    },
    addPrediction: (prediction) => set((state) => {
      const nextPredictions = [...state.predictions, normalizePredictionSummary(prediction)];
      return {
        predictions: applyClaimsCap(nextPredictions),
        lastUpdated: new Date().toISOString()
      };
    }),

    // Customer density actions
    setCustomerDensity: (customerDensity) => set({ customerDensity }),

    // Filter actions
    updateFilters: (filterUpdates) => set((state) => ({
      filters: { ...state.filters, ...filterUpdates }
    })),
    toggleLayer: (layer) => set((state) => ({
      filters: { ...state.filters, [layer]: !state.filters[layer] }
    })),
    setSeverityThreshold: (severity) => set((state) => ({
      filters: { ...state.filters, severityThreshold: severity }
    })),

    // UI state actions
    setLoading: (isLoading) => set({ isLoading }),
    setLastUpdated: (lastUpdated) => set({ lastUpdated }),
    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
    
    // Map view actions
    setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

    // Computed getters
    getFilteredEvents: () => {
      const { events, filters } = get();
      if (!filters.showEvents) return [];
      
      const severityOrder = { low: 0, moderate: 1, high: 2, critical: 3 };
      const thresholdLevel = severityOrder[filters.severityThreshold];
      
      return events.filter(event => 
        severityOrder[event.severity] >= thresholdLevel
      );
    },

    getTotalPredictedClaims: () => {
      const { predictions } = get();
      return predictions.reduce((total, pred) => {
        const claims = pred.expectedClaims || 0;
        return total + (typeof claims === 'number' && !isNaN(claims) ? claims : 0);
      }, 0);
    },

    getTotalAdjustersNeeded: () => {
      const { predictions } = get();
      return predictions.reduce((total, pred) => {
        const adjusters = pred.adjustersNeeded || 0;
        return total + (typeof adjusters === 'number' && !isNaN(adjusters) ? adjusters : 0);
      }, 0);
    }
  }))
);
