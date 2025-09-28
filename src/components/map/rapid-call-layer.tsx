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
      const callCount = call.callCount || call.volume || 0;
      const radius = Math.max(callCount / 5, 8);
      
      // Color based on severity or call volume
      let color = '#EA580C'; // Default orange
      if (call.severity === 'critical' || callCount > 100) {
        color = '#DC2626'; // Red
      } else if (call.severity === 'high' || callCount > 50) {
        color = '#EA580C'; // Orange
      } else if (call.severity === 'moderate' || callCount > 20) {
        color = '#D97706'; // Amber
      } else {
        color = '#65A30D'; // Green
      }
      
      const marker = L.circleMarker([call.coordinates.lat, call.coordinates.lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.7,
        radius: radius,
        weight: 2,
        className: 'crisis-event-marker'
      });

      marker.bindPopup(`
        <div class="p-4 min-w-[250px]">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-4 h-4 rounded-full border-2 border-white shadow-sm" style="background-color: ${color}"></div>
            <h3 class="font-semibold text-base text-gray-900">911 Call Cluster</h3>
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Incident Type:</span>
              <span class="font-medium text-gray-900">${call.incidentType}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Call Volume:</span>
              <span class="font-medium text-gray-900">${callCount} calls</span>
            </div>
            ${call.severity ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Severity:</span>
                <span class="font-medium capitalize px-2 py-1 rounded text-xs" style="background-color: ${color}20; color: ${color}">${call.severity}</span>
              </div>
            ` : ''}
            <div class="flex justify-between">
              <span class="text-gray-600">Last Updated:</span>
              <span class="font-medium text-gray-900">${getTimeAgo(call.lastUpdated)}</span>
            </div>
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
