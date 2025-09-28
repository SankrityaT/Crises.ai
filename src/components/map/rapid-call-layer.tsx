"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useMapStore } from "@/store/map-store";
import { getTimeAgo } from "@/lib/utils";
import L from "leaflet";

export function RapidCallLayer() {
  const map = useMap();
  const { rapidCalls, filters } = useMapStore();

  useEffect(() => {
    if (!map || !filters.showRapidCalls) return;

    const layerGroup = L.layerGroup().addTo(map);

    rapidCalls.forEach((call) => {
      const radius = Math.max(call.volume * 2, 8);
      
      const marker = L.circleMarker([call.coordinates.lat, call.coordinates.lng], {
        color: '#EA580C',
        fillColor: '#EA580C',
        fillOpacity: 0.6,
        radius: radius,
        weight: 3,
        className: 'crisis-pulse'
      });

      marker.bindPopup(`
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-orange-600"></div>
            <h3 class="font-semibold text-sm">911 Call Cluster</h3>
          </div>
          <div class="space-y-1 text-xs text-gray-600">
            <p><strong>Incident Type:</strong> ${call.incidentType}</p>
            <p><strong>Call Volume:</strong> ${call.volume} calls</p>
            <p><strong>Last Updated:</strong> ${getTimeAgo(call.lastUpdated)}</p>
          </div>
        </div>
      `);

      layerGroup.addLayer(marker);
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [map, rapidCalls, filters.showRapidCalls]);

  return null;
}
