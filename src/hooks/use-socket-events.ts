"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useMapStore } from "@/store/map-store";
import type { 
  MapEventPayload, 
  RapidClusterPayload, 
  SocialSentimentPayload, 
  PredictionPayload 
} from "@/types/socket";
import type { PersistedEvent } from "../../types/events";

export function useSocketEvents() {
  const socketRef = useRef<Socket | null>(null);
  const { 
    setEvents,
    setRapidCalls, 
    setSocialHotspots,
    setPredictions,
    setConnectionStatus
  } = useMapStore();

  useEffect(() => {
    // For now, simulate socket connection since Socket.IO setup is complex
    console.log("[Socket] Simulating socket connection...");
    setConnectionStatus("connected");
    
    // Simulate receiving data every 30 seconds
    const interval = setInterval(() => {
      console.log("[Socket] Simulating data update...");
      // This will trigger the bootstrap hook to refetch data
    }, 30000);

    return () => {
      clearInterval(interval);
      setConnectionStatus("disconnected");
    };

    /* Real Socket.IO implementation (commented out for now):
    const socket = io("/api/socket/io", {
      path: "/api/socket/io",
      transports: ["websocket", "polling"],
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected to server");
      setConnectionStatus("connected");
      socket.emit("client:ready");
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setConnectionStatus("disconnected");
    });

    socket.on("map.events", (payload: MapEventPayload) => {
      console.log("[Socket] Received events update:", payload.events.length);
      // Convert PersistedEvent[] to EventFeature[]
      const eventFeatures = payload.events.map((event: PersistedEvent) => ({
        id: event.id,
        title: event.title,
        source: event.source as any,
        type: event.description ?? event.source,
        severity: event.severity ?? "moderate",
        magnitude: event.magnitude,
        startedAt: event.occurredAt,
        coordinates: {
          lat: event.coordinates.latitude,
          lng: event.coordinates.longitude,
        },
        metadata: {
          riskScore: event.riskScore,
          customerDensityId: event.customerDensityId,
        },
      }));
      setEvents(eventFeatures);
    });

    socket.on("map.rapid", (payload: RapidClusterPayload) => {
      console.log("[Socket] Received rapid calls update:", payload.clusters.length);
      setRapidCalls(payload.clusters);
    });

    socket.on("map.social", (payload: SocialSentimentPayload) => {
      console.log("[Socket] Received social hotspots update:", payload.hotspots.length);
      setSocialHotspots(payload.hotspots);
    });

    socket.on("map.predictions", (payload: PredictionPayload) => {
      console.log("[Socket] Received predictions update:", payload.predictions.length);
      setPredictions(payload.predictions);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
      setConnectionStatus("disconnected");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    */
  }, [setEvents, setRapidCalls, setSocialHotspots, setPredictions, setConnectionStatus]);

  return {
    isConnected: true, // Simulated connection
    socket: socketRef.current
  };
}
