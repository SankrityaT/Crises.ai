import { readFile } from "node:fs/promises";
import path from "node:path";
import axios from "axios";

import type { CustomerDensityRegion } from "../../src/types/map";
import { updateCustomerDensityCache } from "../services/stateCache";

// US Census API - Free population density data
const CENSUS_ENDPOINT = "https://api.census.gov/data/2023/pep/population";

interface CensusResponse {
  [key: number]: string[];
}

interface CountyData {
  state: string;
  county: string;
  population: string;
}

function resolveMockPath(filename: string): string {
  return path.resolve(process.cwd(), "data", "mock", filename);
}

async function loadMockCustomerDensity(): Promise<CustomerDensityRegion[]> {
  try {
    const contents = await readFile(resolveMockPath("customer_density.geojson"), "utf-8");
    const geojson = JSON.parse(contents) as {
      features: Array<{
        id?: string;
        properties: {
          name: string;
          densityScore: number;
          population?: number;
        };
        geometry: any;
      }>;
    };

    return geojson.features.map((feature, index) => ({
      id: feature.id ?? `census_${index}`,
      regionName: feature.properties.name,
      densityScore: feature.properties.densityScore,
      population: feature.properties.population,
      geometry: feature.geometry,
      coordinates: [], // Will be populated from geometry if needed
      customerCount: Math.floor((feature.properties.population || 50000) * 0.15), // Assume 15% are State Farm customers
      riskProfile: feature.properties.densityScore > 0.8 ? "high" : 
                   feature.properties.densityScore > 0.5 ? "medium" : "low"
    }));
  } catch (error) {
    console.warn("[Census] Mock file not found, generating synthetic data");
    return generateSyntheticCustomerAreas();
  }
}

function generateSyntheticCustomerAreas(): CustomerDensityRegion[] {
  // Major US metropolitan areas with realistic State Farm customer data
  const metros = [
    { name: "Chicago Metro", lat: 41.8781, lng: -87.6298, pop: 2700000, density: 0.92 },
    { name: "Dallas-Fort Worth", lat: 32.7767, lng: -96.7970, pop: 2400000, density: 0.85 },
    { name: "Houston Metro", lat: 29.7604, lng: -95.3698, pop: 2300000, density: 0.88 },
    { name: "Phoenix Metro", lat: 33.4484, lng: -112.0740, pop: 1700000, density: 0.78 },
    { name: "Atlanta Metro", lat: 33.7490, lng: -84.3880, pop: 1600000, density: 0.82 },
    { name: "Denver Metro", lat: 39.7392, lng: -104.9903, pop: 1400000, density: 0.75 },
    { name: "Tampa Bay", lat: 27.9506, lng: -82.4572, pop: 1200000, density: 0.71 },
    { name: "St. Louis Metro", lat: 38.6270, lng: -90.1994, pop: 1100000, density: 0.68 },
    { name: "Kansas City", lat: 39.0997, lng: -94.5786, pop: 900000, density: 0.65 },
    { name: "Indianapolis", lat: 39.7684, lng: -86.1581, pop: 850000, density: 0.63 }
  ];

  return metros.map((metro, index) => {
    const radius = 0.2; // Approximate area radius in degrees
    
    // Create a simple rectangular area around each metro
    const geometry = {
      type: "Polygon" as const,
      coordinates: [[
        [metro.lng - radius, metro.lat - radius],
        [metro.lng + radius, metro.lat - radius],
        [metro.lng + radius, metro.lat + radius],
        [metro.lng - radius, metro.lat + radius],
        [metro.lng - radius, metro.lat - radius]
      ]]
    };

    return {
      id: `metro_${index}`,
      regionName: metro.name,
      densityScore: metro.density,
      population: metro.pop,
      geometry,
      coordinates: [
        { lat: metro.lat - radius, lng: metro.lng - radius },
        { lat: metro.lat + radius, lng: metro.lng - radius },
        { lat: metro.lat + radius, lng: metro.lng + radius },
        { lat: metro.lat - radius, lng: metro.lng + radius }
      ],
      customerCount: Math.floor(metro.pop * 0.15), // 15% State Farm market share
      riskProfile: metro.density > 0.8 ? "high" : 
                   metro.density > 0.7 ? "medium" : "low"
    } as CustomerDensityRegion;
  });
}

async function fetchCensusData(): Promise<CountyData[]> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[Ingestion][Census] Mock mode enabled. Using synthetic customer areas.");
    return [];
  }

  try {
    // Get population data for major counties
    const response = await axios.get<CensusResponse>(CENSUS_ENDPOINT, {
      timeout: Number(process.env.CENSUS_TIMEOUT_MS ?? 15_000),
      params: {
        get: "POP_2023,NAME",
        for: "county:*",
        in: "state:17,48,06,04,13,08,12,29,20,18", // IL, TX, CA, AZ, GA, CO, FL, MO, KS, IN
      }
    });

    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }

    // Skip header row and parse data
    return response.data.slice(1).map(row => ({
      state: row[3],
      county: row[2], 
      population: row[0]
    }));
  } catch (error) {
    console.warn("[Ingestion][Census] Failed to fetch census data, using synthetic data");
    return [];
  }
}

export async function ingestCensusCustomerData(): Promise<void> {
  try {
    const censusData = await fetchCensusData();

    let customerAreas: CustomerDensityRegion[];

    if (censusData.length > 0) {
      // Process real census data (would need geocoding for coordinates)
      console.log(`[Ingestion][Census] Received ${censusData.length} county records`);
      customerAreas = generateSyntheticCustomerAreas(); // Fallback for now
    } else {
      // Use mock or synthetic data
      customerAreas = await loadMockCustomerDensity();
    }

    if (!customerAreas.length) {
      console.warn("[Ingestion][Census] No customer areas generated.");
      return;
    }

    // Update cache with customer density regions
    updateCustomerDensityCache(customerAreas);

    console.log(
      `[Ingestion][Census] Processed ${customerAreas.length} customer density regions.`
    );
  } catch (error) {
    console.error("[Ingestion][Census] Failed to process customer data", error);
  }
}
