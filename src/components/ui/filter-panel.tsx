"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchBar } from "@/components/ui/search-bar";
import { useMapStore } from "@/store/map-store";
import { geocodeLocation, parseCoordinates, type GeocodingResult } from "@/lib/geocoding";

export function FilterPanel() {
  const { filters, toggleLayer, setSeverityThreshold, setMapView } = useMapStore();

  const handleLocationSearch = async (query: string) => {
    if (!query.trim()) return;

    // Try to parse as coordinates first (lat, lng)
    const coordMatch = query.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setMapView([lat, lng], 12);
        return;
      }
    }

    // Otherwise, geocode the address/location
    try {
      const result = await geocodeLocation(query);
      if (result) {
        setMapView([result.lat, result.lng], 12);
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
    }
  };

  const handleSuggestionSelect = (result: GeocodingResult) => {
    setMapView([result.lat, result.lng], 12);
  };

  const { events, rapidCalls, socialHotspots, customerDensity } = useMapStore();
  
  const layerControls = [
    { 
      key: 'showEvents' as const, 
      label: 'Disaster Events', 
      icon: <div className="w-3 h-3 bg-red-500 rounded-full border border-red-600"></div>,
      color: 'bg-red-50 text-red-800 border-red-200',
      count: events.length
    },
    { 
      key: 'showRapidCalls' as const, 
      label: 'Emergency Calls', 
      icon: <div className="w-3 h-3 bg-orange-500 rounded border border-orange-600"></div>,
      color: 'bg-orange-50 text-orange-800 border-orange-200',
      count: rapidCalls.reduce((sum, call) => sum + (call.callCount || call.volume || 0), 0)
    },
    { 
      key: 'showSocialHotspots' as const, 
      label: 'Social Activity', 
      icon: <div className="w-3 h-3 bg-blue-500 rounded-sm border border-blue-600"></div>,
      color: 'bg-blue-50 text-blue-800 border-blue-200',
      count: socialHotspots.reduce((sum, hotspot) => sum + hotspot.mentionCount, 0)
    },
    { 
      key: 'showCustomerDensity' as const, 
      label: 'Customer Areas', 
      icon: <div className="w-3 h-3 bg-purple-500 rounded-full border border-purple-600 opacity-70"></div>,
      color: 'bg-purple-50 text-purple-800 border-purple-200',
      count: customerDensity.length
    }
  ];

  const severityLevels = [
    { value: 'low' as const, label: 'Low', color: 'bg-green-100 text-green-800 border-green-200' },
    { value: 'moderate' as const, label: 'Moderate', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { value: 'high' as const, label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { value: 'critical' as const, label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200' }
  ];

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-md hover:shadow-lg transition-all duration-300 ease-in-out">
        <div className="mb-3">
          <span className="text-sm font-semibold text-gray-100">Search Locations</span>
        </div>
        <SearchBar 
          onSearch={handleLocationSearch}
          onSuggestionSelect={handleSuggestionSelect}
          placeholder="Search locations..."
          className="mb-6"
        />
      </div>

      {/* Layers */}
      <div className="p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-md hover:shadow-lg transition-all duration-300 ease-in-out">
        <div className="mb-4">
          <span className="text-sm font-semibold text-gray-100">Data Layers</span>
        </div>
        <div className="space-y-2">
          {layerControls.map(({ key, label, icon, color, count }) => (
            <div
              key={key}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                filters[key] 
                  ? color
                  : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
              }`}
              onClick={() => toggleLayer(key)}
            >
              <div className="flex items-center gap-3">
                {icon}
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-1 bg-gray-700 text-gray-100 rounded-md border border-gray-600">
                  {count}
                </span>
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  filters[key] ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div className="p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-md hover:shadow-lg transition-all duration-300 ease-in-out">
        <div className="mb-4">
          <span className="text-sm font-semibold text-gray-100">Alert Severity</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {severityLevels.map(({ value, label, color }) => (
            <button
              key={value}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                filters.severityThreshold === value
                  ? color
                  : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'
              }`}
              onClick={() => setSeverityThreshold(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-md hover:shadow-lg transition-all duration-300 ease-in-out">
        <div className="mb-4">
          <span className="text-sm font-semibold text-gray-100">Map Legend</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full border border-red-600"></div>
              <span className="text-sm text-gray-200">Critical Events</span>
            </div>
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-md font-medium">LIVE</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-orange-500 rounded border border-orange-600"></div>
              <span className="text-sm text-gray-200">Emergency Calls</span>
            </div>
            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-md font-medium">ACTIVE</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-sm border border-blue-600"></div>
              <span className="text-sm text-gray-200">Social Activity</span>
            </div>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">UPDATED</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full border border-purple-600 opacity-70"></div>
              <span className="text-sm text-gray-200">Customer Areas</span>
            </div>
            <span className="text-xs px-2 py-1 bg-gray-700 text-gray-200 rounded-md font-medium border border-gray-600">STATIC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
