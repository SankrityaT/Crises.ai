"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useMapStore } from "@/store/map-store";
import { getSeverityColor, getTimeAgo } from "@/lib/utils";
import L from "leaflet";

export function EventLayer() {
  const map = useMap();
  const { getFilteredEvents } = useMapStore();
  const events = getFilteredEvents();

  useEffect(() => {
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);

    events.forEach((event) => {
      const color = getSeverityColor(event.severity);
      const radius = event.magnitude ? Math.max(event.magnitude * 5, 10) : 15;

      // Create expanding circle for earthquakes
      if (event.type.toLowerCase().includes('earthquake')) {
        const circle = L.circle([event.coordinates.lat, event.coordinates.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.3,
          radius: radius * 1000, // Convert to meters
          className: 'crisis-pulse'
        });

        circle.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
              <h3 class="font-semibold text-sm">${event.title}</h3>
            </div>
            <div class="space-y-1 text-xs text-gray-600">
              <p><strong>Type:</strong> ${event.type}</p>
              <p><strong>Severity:</strong> ${event.severity}</p>
              ${event.magnitude ? `<p><strong>Magnitude:</strong> ${event.magnitude}</p>` : ''}
              <p><strong>Source:</strong> ${event.source.toUpperCase()}</p>
              <p><strong>Time:</strong> ${getTimeAgo(event.startedAt)}</p>
            </div>
          </div>
        `);

        layerGroup.addLayer(circle);
      } 
      // Create polygon for wildfires
      else if (event.type.toLowerCase().includes('fire') || event.type.toLowerCase().includes('wildfire')) {
        // Create a rough fire perimeter (simplified for demo)
        const fireRadius = radius * 0.01; // Convert to degrees roughly
        const firePerimeter = [
          [event.coordinates.lat + fireRadius, event.coordinates.lng - fireRadius],
          [event.coordinates.lat + fireRadius * 0.8, event.coordinates.lng + fireRadius],
          [event.coordinates.lat - fireRadius * 0.5, event.coordinates.lng + fireRadius * 0.8],
          [event.coordinates.lat - fireRadius, event.coordinates.lng - fireRadius * 0.5]
        ];

        const polygon = L.polygon(firePerimeter, {
          color: '#DC2626',
          fillColor: '#FEF2F2',
          fillOpacity: 0.6,
          weight: 2,
          className: 'crisis-pulse'
        });

        polygon.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full bg-red-600"></div>
              <h3 class="font-semibold text-sm">${event.title}</h3>
            </div>
            <div class="space-y-1 text-xs text-gray-600">
              <p><strong>Type:</strong> ${event.type}</p>
              <p><strong>Severity:</strong> ${event.severity}</p>
              <p><strong>Source:</strong> ${event.source.toUpperCase()}</p>
              <p><strong>Time:</strong> ${getTimeAgo(event.startedAt)}</p>
            </div>
          </div>
        `);

        layerGroup.addLayer(polygon);
      }
      // Default marker for other events
      else {
        const marker = L.circleMarker([event.coordinates.lat, event.coordinates.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.7,
          radius: Math.max(radius / 2, 8),
          weight: 2,
          className: 'crisis-pulse-dot'
        });

        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
              <h3 class="font-semibold text-sm">${event.title}</h3>
            </div>
            <div class="space-y-1 text-xs text-gray-600">
              <p><strong>Type:</strong> ${event.type}</p>
              <p><strong>Severity:</strong> ${event.severity}</p>
              <p><strong>Source:</strong> ${event.source.toUpperCase()}</p>
              <p><strong>Time:</strong> ${getTimeAgo(event.startedAt)}</p>
            </div>
          </div>
        `);

        layerGroup.addLayer(marker);
      }
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [map, events]);

  return null;
}
