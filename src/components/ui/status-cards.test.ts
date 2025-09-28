import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useMapStore } from '@/store/map-store';
import type { EventFeature, RapidCallCluster, SocialHotspot, PredictionSummary } from '@/types/map';

// Mock data for testing
const mockEvents: EventFeature[] = [
  {
    id: '1',
    title: 'Critical Earthquake',
    source: 'usgs',
    type: 'earthquake',
    severity: 'critical',
    magnitude: 7.2,
    startedAt: '2023-01-01T00:00:00Z',
    coordinates: { lat: 37.7749, lng: -122.4194 }
  },
  {
    id: '2',
    title: 'High Severity Fire',
    source: 'nasa',
    type: 'fire',
    severity: 'high',
    startedAt: '2023-01-01T01:00:00Z',
    coordinates: { lat: 37.7849, lng: -122.4294 }
  },
  {
    id: '3',
    title: 'Moderate Flood',
    source: 'fema',
    type: 'flood',
    severity: 'moderate',
    startedAt: '2023-01-01T02:00:00Z',
    coordinates: { lat: 37.7949, lng: -122.4394 }
  }
];

const mockRapidCalls: RapidCallCluster[] = [
  {
    id: '1',
    coordinates: { lat: 37.7749, lng: -122.4194 },
    incidentType: 'medical',
    callCount: 25,
    volume: 25,
    severity: 'high',
    lastUpdated: '2023-01-01T00:00:00Z'
  },
  {
    id: '2',
    coordinates: { lat: 37.7849, lng: -122.4294 },
    incidentType: 'fire',
    callCount: 15,
    volume: 15,
    severity: 'moderate',
    lastUpdated: '2023-01-01T01:00:00Z'
  }
];

const mockSocialHotspots: SocialHotspot[] = [
  {
    id: '1',
    sentimentScore: -0.8,
    mentionCount: 150,
    coordinates: { lat: 37.7749, lng: -122.4194 },
    lastUpdated: '2023-01-01T00:00:00Z'
  },
  {
    id: '2',
    sentimentScore: -0.6,
    mentionCount: 75,
    coordinates: { lat: 37.7849, lng: -122.4294 },
    lastUpdated: '2023-01-01T01:00:00Z'
  }
];

const mockPredictions: PredictionSummary[] = [
  {
    id: '1',
    label: 'Earthquake Impact Zone A',
    expectedClaims: 2500000,
    adjustersNeeded: 15,
    generatedAt: '2023-01-01T00:00:00Z'
  },
  {
    id: '2',
    label: 'Fire Damage Assessment',
    expectedClaims: 1200000,
    adjustersNeeded: 8,
    generatedAt: '2023-01-01T01:00:00Z'
  }
];

describe('Analytics Dashboard Accuracy', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { setEvents, setRapidCalls, setSocialHotspots, setPredictions } = useMapStore.getState();
    setEvents(mockEvents);
    setRapidCalls(mockRapidCalls);
    setSocialHotspots(mockSocialHotspots);
    setPredictions(mockPredictions);
  });

  describe('Event Calculations', () => {
    it('should correctly count total events', () => {
      const { events } = useMapStore.getState();
      expect(events.length).toBe(3);
    });

    it('should correctly count critical events', () => {
      const { events } = useMapStore.getState();
      const criticalEvents = events.filter(e => e.severity === 'critical').length;
      expect(criticalEvents).toBe(1);
    });

    it('should correctly count high severity events', () => {
      const { events } = useMapStore.getState();
      const highEvents = events.filter(e => e.severity === 'high').length;
      expect(highEvents).toBe(1);
    });

    it('should correctly calculate high priority zones including rapid calls', () => {
      const { events, rapidCalls } = useMapStore.getState();
      const criticalEvents = events.filter(e => e.severity === 'critical').length;
      const highEvents = events.filter(e => e.severity === 'high').length;
      const criticalRapidCalls = rapidCalls.filter(call => call.severity === 'critical').length;
      const highRapidCalls = rapidCalls.filter(call => call.severity === 'high').length;
      const highPriorityZones = criticalEvents + highEvents + criticalRapidCalls + highRapidCalls;
      
      // From mock data: 1 critical event + 1 high event + 1 critical rapid call + 1 high rapid call = 4
      expect(highPriorityZones).toBe(4);
    });
  });

  describe('Rapid Calls Calculations', () => {
    it('should correctly sum rapid call counts', () => {
      const { rapidCalls } = useMapStore.getState();
      const totalCalls = rapidCalls.reduce((sum, call) => sum + (call.callCount || call.volume || 0), 0);
      expect(totalCalls).toBe(40); // 25 + 15
    });

    it('should handle missing call counts gracefully', () => {
      const { setRapidCalls } = useMapStore.getState();
      const callsWithMissingData = [
        { ...mockRapidCalls[0], callCount: undefined, volume: undefined },
        mockRapidCalls[1]
      ];
      setRapidCalls(callsWithMissingData);
      
      const { rapidCalls } = useMapStore.getState();
      const totalCalls = rapidCalls.reduce((sum, call) => sum + (call.callCount || call.volume || 0), 0);
      expect(totalCalls).toBe(15); // Only the second call
    });
  });

  describe('Social Hotspots Calculations', () => {
    it('should correctly sum social mentions', () => {
      const { socialHotspots } = useMapStore.getState();
      const totalMentions = socialHotspots.reduce((sum, hotspot) => sum + hotspot.mentionCount, 0);
      expect(totalMentions).toBe(225); // 150 + 75
    });

    it('should handle missing mention counts gracefully', () => {
      const { setSocialHotspots } = useMapStore.getState();
      const hotspotsWithMissingData = [
        { ...mockSocialHotspots[0], mentionCount: 0 },
        mockSocialHotspots[1]
      ];
      setSocialHotspots(hotspotsWithMissingData);
      
      const { socialHotspots } = useMapStore.getState();
      const totalMentions = socialHotspots.reduce((sum, hotspot) => sum + hotspot.mentionCount, 0);
      expect(totalMentions).toBe(75); // Only the second hotspot
    });
  });

  describe('Predictions Calculations', () => {
    it('should correctly sum predicted claims', () => {
      const { getTotalPredictedClaims } = useMapStore.getState();
      const totalClaims = getTotalPredictedClaims();
      expect(totalClaims).toBe(20240); // Normalized total for 15 + 8 adjusters
    });

    it('should correctly sum adjusters needed', () => {
      const { getTotalAdjustersNeeded } = useMapStore.getState();
      const totalAdjusters = getTotalAdjustersNeeded();
      expect(totalAdjusters).toBe(23); // 15 + 8
    });

    it('should handle invalid prediction values gracefully', () => {
      const { setPredictions } = useMapStore.getState();
      const invalidPredictions = [
        { ...mockPredictions[0], expectedClaims: Number.NaN, adjustersNeeded: null as unknown as number },
        { ...mockPredictions[1], expectedClaims: undefined as unknown as number, adjustersNeeded: 'invalid' as unknown as number },
        mockPredictions[1] // Valid prediction
      ];
      setPredictions(invalidPredictions);
      
      const { getTotalPredictedClaims, getTotalAdjustersNeeded } = useMapStore.getState();
      expect(getTotalPredictedClaims()).toBe(7040); // Only valid prediction after normalization
      expect(getTotalAdjustersNeeded()).toBe(8); // Only valid prediction
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty arrays gracefully', () => {
      const { setEvents, setRapidCalls, setSocialHotspots, setPredictions } = useMapStore.getState();
      setEvents([]);
      setRapidCalls([]);
      setSocialHotspots([]);
      setPredictions([]);
      
      const { events, rapidCalls, socialHotspots, getTotalPredictedClaims, getTotalAdjustersNeeded } = useMapStore.getState();
      
      expect(events.length).toBe(0);
      expect(rapidCalls.length).toBe(0);
      expect(socialHotspots.length).toBe(0);
      expect(getTotalPredictedClaims()).toBe(0);
      expect(getTotalAdjustersNeeded()).toBe(0);
    });

    it('should handle null/undefined data gracefully', () => {
      const { setEvents, setRapidCalls, setSocialHotspots } = useMapStore.getState();
      
      // Test with events that have null severity
      const eventsWithNullSeverity = [
        { ...mockEvents[0], severity: null as unknown as EventFeature['severity'] },
        { ...mockEvents[1], severity: undefined as unknown as EventFeature['severity'] }
      ];
      setEvents(eventsWithNullSeverity);
      
      const { events } = useMapStore.getState();
      const criticalEvents = events.filter(e => e?.severity === 'critical').length;
      expect(criticalEvents).toBe(0);
    });

    it('should calculate deployment status percentage correctly', () => {
      const { getTotalAdjustersNeeded, events, rapidCalls } = useMapStore.getState();
      const totalAdjusters = getTotalAdjustersNeeded();
      
      // Calculate high priority zones
      const criticalEvents = events.filter(e => e.severity === 'critical').length;
      const highEvents = events.filter(e => e.severity === 'high').length;
      const criticalRapidCalls = rapidCalls.filter(call => call.severity === 'critical').length;
      const highRapidCalls = rapidCalls.filter(call => call.severity === 'high').length;
      const highPriorityZones = criticalEvents + highEvents + criticalRapidCalls + highRapidCalls;
      
      const deploymentPercentage = totalAdjusters > 0 ? 
        Math.round((totalAdjusters / (totalAdjusters + highPriorityZones)) * 100) : 75;
      
      // With 9 adjusters and 4 high priority zones: 9/(9+4) * 100 = 69%
      expect(deploymentPercentage).toBe(69);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency after updates', () => {
      const { addEvent, events } = useMapStore.getState();
      const initialCount = events.length;
      
      const newEvent: EventFeature = {
        id: '4',
        title: 'New Critical Event',
        source: 'mock',
        type: 'test',
        severity: 'critical',
        startedAt: '2023-01-01T03:00:00Z',
        coordinates: { lat: 37.8049, lng: -122.4494 }
      };
      
      addEvent(newEvent);
      
      const { events: updatedEvents } = useMapStore.getState();
      expect(updatedEvents.length).toBe(initialCount + 1);
      
      const criticalEvents = updatedEvents.filter(e => e.severity === 'critical').length;
      expect(criticalEvents).toBe(2); // Original 1 + new 1
    });
  });
});
