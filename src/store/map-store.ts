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

interface MapStore extends MapState {
  // Connection status
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
  
  // Map view state
  mapCenter: [number, number];
  mapZoom: number;
  setMapView: (center: [number, number], zoom: number) => void;
  
  // Actions
  setEvents: (events: any[]) => void;
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
  
  setCustomerDensity: (regions: any[]) => void;
  
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
    setPredictions: (predictions) => set({ predictions, lastUpdated: new Date().toISOString() }),
    addPrediction: (prediction) => set((state) => ({ 
      predictions: [...state.predictions, prediction],
      lastUpdated: new Date().toISOString()
    })),

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
      return predictions.reduce((total, pred) => total + pred.expectedClaims, 0);
    },

    getTotalAdjustersNeeded: () => {
      const { predictions } = get();
      return predictions.reduce((total, pred) => total + pred.adjustersNeeded, 0);
    }
  }))
);
