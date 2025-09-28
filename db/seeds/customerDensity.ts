import { config } from "dotenv";

config({ path: ".env.local", override: true });
config();
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { customerDensity } from "../schema";

type CustomerDensityInsert = typeof customerDensity.$inferInsert;

interface CustomerDensityFeatureProperties {
  id?: string;
  name: string;
  densityScore: number;
  population?: number;
}

interface CustomerDensityFeature {
  type: "Feature";
  id?: string;
  properties: CustomerDensityFeatureProperties;
  geometry: Record<string, unknown>;
}

interface CustomerDensityCollection {
  type: "FeatureCollection";
  features: CustomerDensityFeature[];
}

function resolveMockPath(filename: string): string {
  const cwd = process.cwd();
  return path.resolve(cwd, "data", "mock", filename);
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not defined. Provide a connection string to run the seed."
    );
  }

  const shouldUseSSL = process.env.DATABASE_SSL !== "false";

  return new Pool({
    connectionString,
    ssl: shouldUseSSL ? { rejectUnauthorized: false } : undefined,
  });
}

async function loadMockData(): Promise<CustomerDensityCollection> {
  const filePath = resolveMockPath("customer_density.geojson");
  const fileContent = await readFile(filePath, "utf-8");
  return JSON.parse(fileContent) as CustomerDensityCollection;
}

async function seed() {
  const pool = getPool();
  const db = drizzle(pool);

  try {
    const featureCollection = await loadMockData();

    const rows: CustomerDensityInsert[] = featureCollection.features.map((feature, index) => {
      const properties = feature.properties;
      const id =
        properties.id ?? feature.id ?? `density_${properties.name.toLowerCase().replace(/\s+/g, "_")}_${index}`;

      return {
        id,
        regionName: properties.name,
        densityScore: properties.densityScore,
        population: properties.population ?? null,
        geom: feature.geometry,
        updatedAt: new Date(),
      } satisfies CustomerDensityInsert;
    });

    if (!rows.length) {
      console.warn("[Seed][CustomerDensity] No features found in dataset.");
      return;
    }

    for (const row of rows) {
      const { id, ...update } = row;
      await db
        .insert(customerDensity)
        .values(row)
        .onConflictDoUpdate({
          target: customerDensity.id,
          set: {
            ...update,
            updatedAt: new Date(),
          },
        });
    }

    console.log(
      `[Seed][CustomerDensity] Upserted ${rows.length} customer density regions.`
    );
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("[Seed][CustomerDensity] Failed", error);
  process.exit(1);
});
