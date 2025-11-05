import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured, schema } from "./db";
import { PersistedEvent } from "../../types/events";

export async function upsertEvents(events: PersistedEvent[]): Promise<void> {
  if (!events.length) {
    return;
  }

  if (!isDatabaseConfigured()) {
    console.warn(
      "[Repository][Events] DATABASE_URL not set. Skipping persistence for %d events.",
      events.length
    );
    return;
  }

  try {
    const db = getDb();

    for (const event of events) {
      const { id, raw, ...rest } = event;
      const row: typeof schema.events.$inferInsert = {
        id,
        source: rest.source,
        title: rest.title,
        description: rest.description ?? null,
        severity: rest.severity ?? "moderate",
        magnitude: rest.magnitude ?? null,
        occurredAt: new Date(rest.occurredAt),
        latitude: rest.coordinates.latitude,
        longitude: rest.coordinates.longitude,
        depth: rest.coordinates.depth ?? null,
        riskScore: rest.riskScore ?? null,
        customerDensityId: rest.customerDensityId ?? null,
        raw,
        updatedAt: new Date(),
      };

      if (!row.id) {
        row.id = `${rest.source}_${randomUUID()}`;
      }

      await db
        .insert(schema.events)
        .values(row)
        .onConflictDoUpdate({
          target: schema.events.id,
          set: {
            source: row.source,
            title: row.title,
            description: row.description,
            severity: row.severity,
            magnitude: row.magnitude,
            occurredAt: row.occurredAt,
            latitude: row.latitude,
            longitude: row.longitude,
            depth: row.depth,
            riskScore: row.riskScore,
            customerDensityId: row.customerDensityId,
            raw: row.raw,
            updatedAt: sql`now()`
          },
        });
    }
    console.log(`[Repository][Events] Successfully persisted ${events.length} events to database`);
  } catch (error) {
    console.warn(
      `[Repository][Events] Failed to persist ${events.length} events to database. Data will only be available in cache.`,
      error instanceof Error ? error.message : error
    );
    // Don't throw - let the ingestion continue with cache-only mode
  }
}
