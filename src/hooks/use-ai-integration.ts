"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "@/store/map-store";
import type {
  ClaimForecastInsight,
  ClaimForecastResponse,
  DisasterEventContext,
  SocialMentionPayload,
} from "@/types/ai";

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
          const severityToNumber = (severity: string): number => {
            switch (severity) {
              case 'critical': return 4;
              case 'high': return 3;
              case 'moderate': return 2;
              case 'low': return 1;
              default: return 2;
            }
          };

          const eventContexts: DisasterEventContext[] = events.map(event => ({
            eventId: event.id,
            hazardType: event.type,
            severity: severityToNumber(event.severity),
            magnitude: event.magnitude || 0,
            location: {
              lat: event.coordinates.lat,
              lng: event.coordinates.lng,
            },
            customerDensity: Number(event.metadata?.riskScore) || 0,
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
            const predictData = (await predictResponse.json()) as ClaimForecastResponse;
            console.log("[AI] Received claim predictions:", predictData);
            
            // Convert AI response to PredictionSummary format
            const predictions = predictData.insights?.map((insight: ClaimForecastInsight, index: number) => {
              // Parse expected claims more robustly
              let expectedClaims = 0;
              if (insight.expectedClaimsRange) {
                const claimsStr = insight.expectedClaimsRange.toString();
                const match = claimsStr.match(/(\d+(?:\.\d+)?)\s*[kK]?/);
                if (match) {
                  expectedClaims = parseFloat(match[1]) * (claimsStr.toLowerCase().includes('k') ? 1000 : 1);
                }
              }
              
              // Ensure minimum realistic values
              expectedClaims = Math.max(expectedClaims, 50);
              
              // Parse adjuster count
              let adjustersNeeded = 0;
              if (insight.adjusterRecommendation) {
                const adjMatch = insight.adjusterRecommendation.toString().match(/(\d+)/);
                adjustersNeeded = adjMatch ? parseInt(adjMatch[1], 10) : Math.ceil(expectedClaims / 1000);
              }
              
              // Create more descriptive labels
              let label = insight.summary || `Event ${index + 1}`;
              if (label.includes('kontur')) {
                // Replace generic kontur labels with more specific ones
                const eventTypes = ['Wildfire', 'Earthquake', 'Flood', 'Storm', 'Hurricane'];
                const randomType = eventTypes[index % eventTypes.length];
                label = `${randomType} impact assessment`;
              }
              
              return {
                id: insight.eventId || `prediction_${index}`,
                label: label.length > 40 ? label.substring(0, 37) + '...' : label,
                expectedClaims,
                adjustersNeeded: Math.max(adjustersNeeded, 1),
                generatedAt: predictData.generatedAt || new Date().toISOString(),
              };
            }) || [];

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
              lat: hotspot.coordinates.lat,
              lng: hotspot.coordinates.lng,
            },
            timestamp: hotspot.lastUpdated,
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
