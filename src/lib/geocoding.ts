/**
 * Geocoding service for converting addresses/cities to coordinates
 */

export interface GeocodingResult {
  lat: number;
  lng: number;
  display_name: string;
  boundingbox?: [string, string, string, string];
}

/**
 * Search for location suggestions using Nominatim (OpenStreetMap) API
 * Returns multiple results for autocomplete/suggestions
 */
export async function searchLocationSuggestions(query: string): Promise<GeocodingResult[]> {
  if (!query.trim() || query.length < 3) return [];

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=5&addressdetails=1&dedupe=1`,
      {
        headers: {
          'User-Agent': 'Crises.ai/1.0 (Emergency Management Platform)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return [];
    }

    return data.map((result: any) => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      display_name: result.display_name,
      boundingbox: result.boundingbox
    }));
  } catch (error) {
    console.error('Search suggestions error:', error);
    return [];
  }
}

/**
 * Geocode a search query using Nominatim (OpenStreetMap) API
 * Free service, no API key required
 */
export async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  if (!query.trim()) return null;

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Crises.ai/1.0 (Emergency Management Platform)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      display_name: result.display_name,
      boundingbox: result.boundingbox
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Parse coordinates from a string (e.g., "37.7749, -122.4194")
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const coordPattern = /^(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)$/;
  const match = input.trim().match(coordPattern);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  
  return null;
}
