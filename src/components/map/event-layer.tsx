"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useMapStore } from "@/store/map-store";
import { getSeverityColor, getTimeAgo } from "@/lib/utils";
import L from "leaflet";

// Custom icon factory for different event types
function createEventIcon(event: any, color: string) {
  const size = event.severity === 'critical' ? 16 : event.severity === 'high' ? 14 : 12;
  const iconHtml = getEventIconSVG(event.type, color, size);
  
  return L.divIcon({
    html: iconHtml,
    className: 'crisis-event-marker',
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    popupAnchor: [0, -size]
  });
}

function getEventIconSVG(eventType: string, color: string, size: number) {
  const type = eventType.toLowerCase();
  
  if (type.includes('earthquake')) {
    return `
      <div class="relative">
        <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 24 24" fill="none" class="drop-shadow-lg">
          <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
          <path d="M8 12h2l2-4 2 8 2-4h2" stroke="white" stroke-width="2" fill="none"/>
        </svg>
        <div class="absolute inset-0 rounded-full animate-ping bg-current opacity-20" style="color: ${color}"></div>
      </div>
    `;
  }
  
  if (type.includes('fire') || type.includes('wildfire')) {
    return `
      <div class="relative">
        <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 24 24" fill="none" class="drop-shadow-lg">
          <path d="M12 2C8.5 2 6 4.5 6 8c0 3.5 2.5 6 6 6s6-2.5 6-6c0-3.5-2.5-6-6-6z" fill="#DC2626"/>
          <path d="M12 8c-1.5 0-3 1.5-3 3s1.5 3 3 3 3-1.5 3-3-1.5-3-3-3z" fill="#FEF2F2"/>
          <circle cx="12" cy="20" r="2" fill="#DC2626"/>
        </svg>
        <div class="absolute inset-0 rounded-full animate-pulse bg-red-500 opacity-30"></div>
      </div>
    `;
  }
  
  if (type.includes('flood') || type.includes('hurricane') || type.includes('storm')) {
    return `
      <div class="relative">
        <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 24 24" fill="none" class="drop-shadow-lg">
          <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
          <path d="M6 12c2-2 4 2 6 0s4 2 6 0" stroke="white" stroke-width="2" fill="none"/>
          <path d="M6 16c2-2 4 2 6 0s4 2 6 0" stroke="white" stroke-width="2" fill="none"/>
        </svg>
        <div class="absolute inset-0 rounded-full animate-bounce bg-current opacity-20" style="color: ${color}"></div>
      </div>
    `;
  }
  
  // Default disaster icon
  return `
    <div class="relative">
      <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 24 24" fill="none" class="drop-shadow-lg">
        <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
        <path d="M12 8v4m0 4h.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <div class="absolute inset-0 rounded-full animate-pulse bg-current opacity-25" style="color: ${color}"></div>
    </div>
  `;
}

export function EventLayer() {
  const map = useMap();
  const { getFilteredEvents } = useMapStore();
  const events = getFilteredEvents();

  useEffect(() => {
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);

    events.forEach((event) => {
      const color = getSeverityColor(event.severity);
      const icon = createEventIcon(event, color);
      
      const marker = L.marker([event.coordinates.lat, event.coordinates.lng], {
        icon: icon
      });

      marker.bindPopup(`
        <div class="p-4 min-w-[250px] max-w-[300px]">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-4 h-4 rounded-full border-2 border-white shadow-sm" style="background-color: ${color}"></div>
            <h3 class="font-semibold text-base text-gray-900">${event.title}</h3>
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Type:</span>
              <span class="font-medium text-gray-900">${event.type}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Severity:</span>
              <span class="font-medium capitalize px-2 py-1 rounded text-xs" style="background-color: ${color}20; color: ${color}">${event.severity}</span>
            </div>
            ${event.magnitude ? `
              <div class="flex justify-between">
                <span class="text-gray-600">Magnitude:</span>
                <span class="font-medium text-gray-900">${event.magnitude}</span>
              </div>
            ` : ''}
            <div class="flex justify-between">
              <span class="text-gray-600">Source:</span>
              <span class="font-medium text-gray-900 uppercase text-xs">${event.source}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Time:</span>
              <span class="font-medium text-gray-900">${getTimeAgo(event.startedAt)}</span>
            </div>
            ${event.metadata?.riskScore ? `
              <div class="flex justify-between pt-2 border-t border-gray-200">
                <span class="text-gray-600">Risk Score:</span>
                <span class="font-medium text-gray-900">${Math.round(Number(event.metadata.riskScore) * 100)}%</span>
              </div>
            ` : ''}
          </div>
        </div>
      `);

      layerGroup.addLayer(marker);
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [map, events]);

  return null;
}
