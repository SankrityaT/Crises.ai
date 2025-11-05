"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "@/store/map-store";
import { AI_RATE_LIMITS } from "@/config/ai-rate-limits";
import { aiUsageTracker } from "@/lib/ai-usage-tracker";
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
  const lastCallTimeRef = useRef<number>(0);
  const eventsHashRef = useRef<string>("");
  const socialHashRef = useRef<string>("");

  useEffect(() => {
    // Skip if no new data or already processing
    if (!lastUpdated || lastUpdated === lastProcessedRef.current) {
      return;
    }

    // Generate content hashes to detect actual changes
    const eventsHash = JSON.stringify(events.map(e => `${e.id}-${e.severity}-${e.magnitude}`));
    const socialHash = JSON.stringify(socialHotspots.map(s => `${s.id}-${s.sentimentScore}`));
    
    // Skip if content hasn't actually changed
    if (eventsHash === eventsHashRef.current && socialHash === socialHashRef.current) {
      lastProcessedRef.current = lastUpdated;
      return;
    }

    const processAIUpdates = async () => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTimeRef.current;
      
      // CRITICAL: Enforce minimum interval between AI calls
      if (timeSinceLastCall < AI_RATE_LIMITS.MIN_CALL_INTERVAL) {
        console.log(`[AI] Rate limited: ${Math.round((AI_RATE_LIMITS.MIN_CALL_INTERVAL - timeSinceLastCall) / 1000)}s until next call allowed`);
        lastProcessedRef.current = lastUpdated;
        return;
      }
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
            aiUsageTracker.recordCall('predict');
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
            aiUsageTracker.recordCall('sentiment');
            console.log("[AI] Received sentiment analysis:", sentimentData);
            // Could store sentiment insights in a separate store slice if needed
          }
        }

        // Update tracking refs
        lastProcessedRef.current = lastUpdated;
        lastCallTimeRef.current = Date.now();
        eventsHashRef.current = eventsHash;
        socialHashRef.current = socialHash;
        
        console.log(`[AI] Processed updates. Next call allowed in ${AI_RATE_LIMITS.MIN_CALL_INTERVAL / 60000} minutes`);
        console.log(aiUsageTracker.getSummary());
      } catch (error) {
        console.error("[AI] Failed to process AI updates:", error);
      }
    };

    // Debounce AI calls to avoid excessive requests
    const timeoutId = setTimeout(processAIUpdates, AI_RATE_LIMITS.DEBOUNCE_DELAY);
    return () => clearTimeout(timeoutId);
  }, [events, socialHotspots, lastUpdated, setPredictions]);
}
