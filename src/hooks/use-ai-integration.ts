"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "@/store/map-store";
import type { DisasterEventContext } from "@/types/ai";
import type { SocialMentionPayload } from "@/types/ai";

export function useAIIntegration() {
  const { 
    events, 
    socialHotspots, 
    setPredictions,
    lastUpdated 
  } = useMapStore();
  
  const lastProcessedRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if no new data or already processing
    if (!lastUpdated || lastUpdated === lastProcessedRef.current) {
      return;
    }

    const processAIUpdates = async () => {
      try {
        // Process claim predictions if we have events
        if (events.length > 0) {
          const eventContexts: DisasterEventContext[] = events.map(event => ({
            id: event.id,
            hazardType: event.type,
            severity: event.severity,
            magnitude: event.magnitude || 0,
            coordinates: {
              latitude: event.coordinates.lat,
              longitude: event.coordinates.lng,
            },
            customerDensity: event.metadata?.riskScore || 0,
            metadata: {
              source: event.source,
              startedAt: event.startedAt,
              riskScore: event.metadata?.riskScore,
            },
          }));

          const predictResponse = await fetch("/api/ai/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events: eventContexts }),
          });

          if (predictResponse.ok) {
            const predictData = await predictResponse.json();
            console.log("[AI] Received claim predictions:", predictData);
            
            // Convert AI response to PredictionSummary format
            const predictions = predictData.insights?.map((insight: any) => ({
              id: insight.eventId,
              label: insight.summary,
              expectedClaims: parseInt(insight.expectedClaimsRange.split('-')[0].replace('k', '000')) || 0,
              adjustersNeeded: parseInt(insight.adjusterRecommendation.match(/\d+/)?.[0] || '0'),
              generatedAt: predictData.generatedAt,
            })) || [];

            setPredictions(predictions);
          }
        }

        // Process sentiment analysis if we have social hotspots
        if (socialHotspots.length > 0) {
          const socialMentions: SocialMentionPayload[] = socialHotspots.map(hotspot => ({
            postId: hotspot.id,
            platform: "twitter",
            text: `Social activity detected with sentiment score ${hotspot.sentimentScore}`,
            location: {
              latitude: hotspot.coordinates.lat,
              longitude: hotspot.coordinates.lng,
            },
            timestamp: hotspot.lastUpdated,
            verified: false,
          }));

          const sentimentResponse = await fetch("/api/ai/sentiment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mentions: socialMentions }),
          });

          if (sentimentResponse.ok) {
            const sentimentData = await sentimentResponse.json();
            console.log("[AI] Received sentiment analysis:", sentimentData);
            // Could store sentiment insights in a separate store slice if needed
          }
        }

        lastProcessedRef.current = lastUpdated;
      } catch (error) {
        console.error("[AI] Failed to process AI updates:", error);
      }
    };

    // Debounce AI calls to avoid excessive requests
    const timeoutId = setTimeout(processAIUpdates, 2000);
    return () => clearTimeout(timeoutId);
  }, [events, socialHotspots, lastUpdated, setPredictions]);
}
