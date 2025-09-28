import axios from "axios";

const USGS_ENDPOINT =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";

export interface NormalizedEvent {
  id: string;
  title: string;
  coordinates: [number, number, number?];
  magnitude?: number;
  occurredAt: string;
  raw: unknown;
}

export async function ingestUSGS(): Promise<void> {
  if (process.env.USE_MOCK_DATA === "true") {
    console.log("[Ingestion][USGS] Mock mode enabled. Skipping live fetch.");
    return;
  }

  try {
    const response = await axios.get(USGS_ENDPOINT, {
      timeout: 5000,
    });

    if (!response.data?.features) {
      console.warn("[Ingestion][USGS] Unexpected response shape");
      return;
    }

    const events: NormalizedEvent[] = response.data.features.map(
      (feature: any) => ({
        id: feature.id,
        title: feature.properties?.title ?? "USGS Event",
        coordinates: feature.geometry?.coordinates ?? [0, 0],
        magnitude: feature.properties?.mag ?? undefined,
        occurredAt: new Date(feature.properties?.time ?? Date.now()).toISOString(),
        raw: feature,
      })
    );

    console.log(
      `[Ingestion][USGS] Retrieved ${events.length} events. Persistence logic pending.`
    );
  } catch (error) {
    console.error("[Ingestion][USGS] Failed to fetch feed", error);
  }
}
