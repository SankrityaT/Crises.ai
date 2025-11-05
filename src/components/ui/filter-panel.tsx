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
    <div className="space-y-4">
      {/* Search */}
      <div className="group">
        <div className="mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Location Search</span>
        </div>
        <div className="relative z-50">
          <SearchBar 
            onSearch={handleLocationSearch}
            onSuggestionSelect={handleSuggestionSelect}
            placeholder="Search locations..."
            className="mb-0"
          />
        </div>
        {/* Spacer for suggestions dropdown */}
        <div className="h-4"></div>
      </div>

      {/* Layers */}
      <div className="group">
        <div className="mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Data Layers</span>
        </div>
        <div className="space-y-2">
          {layerControls.map(({ key, label, icon, color, count }) => (
            <div
              key={key}
              className={`relative overflow-hidden flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-300 group/item ${
                filters[key] 
                  ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 shadow-lg shadow-blue-500/10'
                  : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-[var(--accent-primary)]/50 hover:shadow-md'
              }`}
              onClick={() => toggleLayer(key)}
            >
              <div className="flex items-center gap-3 z-10">
                <div className={`p-2 rounded-lg transition-all duration-300 ${
                  filters[key] ? 'bg-blue-500/20' : 'bg-[var(--hover-bg)]'
                }`}>
                  {icon}
                </div>
                <div>
                  <span className="text-sm font-semibold text-[var(--text-primary)] block">{label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{count} active</span>
                </div>
              </div>
              <div className="flex items-center gap-3 z-10">
                <div className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                  filters[key] ? 'bg-blue-500' : 'bg-[var(--hover-bg)]'
                }`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${
                    filters[key] ? 'left-6' : 'left-1'
                  }`} />
                </div>
              </div>
              {filters[key] && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div className="group">
        <div className="mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Severity Filter</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {severityLevels.map(({ value, label }) => {
            const isActive = filters.severityThreshold === value;
            const colorMap = {
              low: { bg: 'from-green-500 to-emerald-500', border: 'border-green-500/50', text: 'text-green-600' },
              moderate: { bg: 'from-yellow-500 to-amber-500', border: 'border-yellow-500/50', text: 'text-yellow-600' },
              high: { bg: 'from-orange-500 to-red-500', border: 'border-orange-500/50', text: 'text-orange-600' },
              critical: { bg: 'from-red-500 to-rose-600', border: 'border-red-500/50', text: 'text-red-600' }
            };
            const colors = colorMap[value];
            
            return (
              <button
                key={value}
                className={`relative overflow-hidden px-3 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
                  isActive
                    ? `bg-gradient-to-r ${colors.bg} text-white border-transparent shadow-lg`
                    : `bg-[var(--card-bg)] border-[var(--card-border)] ${colors.text} hover:border-[var(--accent-primary)]/50 hover:shadow-md`
                }`}
                onClick={() => setSeverityThreshold(value)}
              >
                {label}
                {isActive && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="group">
        <div className="mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Map Legend</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
              <span className="text-xs font-medium text-[var(--text-secondary)]">Critical Events</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md font-bold uppercase tracking-wider">LIVE</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-orange-500 rounded shadow-lg shadow-orange-500/50"></div>
              <span className="text-xs font-medium text-[var(--text-secondary)]">Emergency Calls</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded-md font-bold uppercase tracking-wider">ACTIVE</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm shadow-lg shadow-blue-500/50"></div>
              <span className="text-xs font-medium text-[var(--text-secondary)]">Social Activity</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md font-bold uppercase tracking-wider">UPDATED</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-purple-500 rounded-full opacity-70 shadow-lg shadow-purple-500/50"></div>
              <span className="text-xs font-medium text-[var(--text-secondary)]">Customer Areas</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-[var(--hover-bg)] text-[var(--text-muted)] rounded-md font-bold uppercase tracking-wider border border-[var(--card-border)]">STATIC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
