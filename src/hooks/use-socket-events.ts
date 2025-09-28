"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "@/store/map-store";
import type { WebSocketPayload } from "@/types/map";

export function useSocketEvents() {
  const socketRef = useRef<WebSocket | null>(null);
  const { 
    addEvent, 
    updateEvent, 
    addRapidCall, 
    updateRapidCall, 
    addSocialHotspot, 
    updateSocialHotspot,
    addPrediction 
  } = useMapStore();

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.warn("NEXT_PUBLIC_WS_URL not configured, WebSocket disabled");
      return;
    }

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
      };

      socket.onmessage = (event) => {
        try {
          const payload: WebSocketPayload = JSON.parse(event.data);
          
          switch (payload.type) {
            case "event_update":
              if ("severity" in payload.data) {
                addEvent(payload.data);
              }
              break;
              
            case "rapid_call_update":
              if ("incidentType" in payload.data) {
                addRapidCall(payload.data);
              }
              break;
              
            case "social_update":
              if ("sentimentScore" in payload.data) {
                addSocialHotspot(payload.data);
              }
              break;
              
            case "prediction_update":
              if ("expectedClaims" in payload.data) {
                addPrediction(payload.data);
              }
              break;
              
            default:
              console.warn("Unknown WebSocket payload type:", payload.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (socketRef.current?.readyState === WebSocket.CLOSED) {
            console.log("Attempting to reconnect WebSocket...");
            // Recursive call to re-establish connection
            useSocketEvents();
          }
        }, 5000);
      };

    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [addEvent, updateEvent, addRapidCall, updateRapidCall, addSocialHotspot, updateSocialHotspot, addPrediction]);

  return {
    isConnected: socketRef.current?.readyState === WebSocket.OPEN,
    socket: socketRef.current
  };
}
