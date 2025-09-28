"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useMapStore } from "@/store/map-store";
import { getTimeAgo } from "@/lib/utils";
import L from "leaflet";

export function SocialHotspotLayer() {
  const map = useMap();
  const { socialHotspots, filters } = useMapStore();

  useEffect(() => {
    if (!map || !filters.showSocialHotspots) return;

    const layerGroup = L.layerGroup().addTo(map);

    socialHotspots.forEach((hotspot) => {
      const radius = Math.max(hotspot.mentionCount / 2, 6);
      const color = hotspot.sentimentScore < 0.3 ? '#DC2626' : 
                   hotspot.sentimentScore < 0.6 ? '#D97706' : '#65A30D';
      
      const marker = L.circleMarker([hotspot.coordinates.lat, hotspot.coordinates.lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.4,
        radius: radius,
        weight: 2,
        className: 'crisis-pulse-dot'
      });

      const sentimentLabel = hotspot.sentimentScore < 0.3 ? 'Negative' :
                            hotspot.sentimentScore < 0.6 ? 'Neutral' : 'Positive';

      marker.bindPopup(`
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
            <h3 class="font-semibold text-sm">Social Media Hotspot</h3>
          </div>
          <div class="space-y-1 text-xs text-gray-600">
            <p><strong>Mentions:</strong> ${hotspot.mentionCount}</p>
            <p><strong>Sentiment:</strong> ${sentimentLabel} (${(hotspot.sentimentScore * 100).toFixed(0)}%)</p>
            <p><strong>Last Updated:</strong> ${getTimeAgo(hotspot.lastUpdated)}</p>
          </div>
        </div>
      `);

      layerGroup.addLayer(marker);
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [map, socialHotspots, filters.showSocialHotspots]);

  return null;
}
