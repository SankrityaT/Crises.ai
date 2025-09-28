"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useMapStore } from "@/store/map-store";
import L from "leaflet";

export function CustomerDensityLayer() {
  const map = useMap();
  const { customerDensity, filters } = useMapStore();

  useEffect(() => {
    if (!map || !filters.showCustomerDensity || !customerDensity?.length) return;

    const layerGroup = L.layerGroup().addTo(map);

    customerDensity.forEach((region) => {
      // Skip if region doesn't have coordinates
      if (!region.coordinates || !Array.isArray(region.coordinates)) {
        return;
      }

      const color = region.riskProfile === 'high' ? '#DC2626' :
                   region.riskProfile === 'medium' ? '#D97706' : '#65A30D';
      
      const polygon = L.polygon(
        region.coordinates.map(coord => [coord.lat, coord.lng]),
        {
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 1,
          opacity: 0.6
        }
      );

      polygon.bindPopup(`
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
            <h3 class="font-semibold text-sm">Customer Density Region</h3>
          </div>
          <div class="space-y-1 text-xs text-gray-600">
            <p><strong>Customers:</strong> ${region.customerCount.toLocaleString()}</p>
            <p><strong>Risk Profile:</strong> ${region.riskProfile}</p>
          </div>
        </div>
      `);

      layerGroup.addLayer(polygon);
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [map, customerDensity, filters.showCustomerDensity]);

  return null;
}
