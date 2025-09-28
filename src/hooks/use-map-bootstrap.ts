"use client";

import { useEffect } from "react";

import type { MapBootstrapPayload } from "@/types/map";
import { useMapStore } from "@/store/map-store";

export function useMapBootstrap() {
  const {
    setEvents,
    setRapidCalls,
    setSocialHotspots,
    setPredictions,
    setCustomerDensity,
    setLoading,
    setLastUpdated,
  } = useMapStore();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/map/bootstrap", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Bootstrap request failed with ${response.status}`);
        }

        const payload = (await response.json()) as MapBootstrapPayload;
        if (cancelled) {
          return;
        }

        setEvents(payload.events);
        setRapidCalls(payload.rapidCalls);
        setSocialHotspots(payload.socialHotspots);
        setPredictions(payload.predictions);
        setCustomerDensity(payload.customerDensity);
        setLastUpdated(new Date().toISOString());
      } catch (error) {
        console.error("Failed to load map bootstrap payload", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    setCustomerDensity,
    setEvents,
    setLastUpdated,
    setLoading,
    setPredictions,
    setRapidCalls,
    setSocialHotspots,
  ]);
}
