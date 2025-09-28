import { index, integer, jsonb, pgTable, text, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity").notNull().default("moderate"),
    magnitude: doublePrecision("magnitude"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    depth: doublePrecision("depth"),
    riskScore: doublePrecision("risk_score"),
    customerDensityId: text("customer_density_id"),
    raw: jsonb("raw").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    occurredAtIdx: index("events_occurred_at_idx").on(table.occurredAt),
    sourceIdx: index("events_source_idx").on(table.source),
  })
);

export const socialMentions = pgTable(
  "social_mentions",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    content: text("content").notNull(),
    sentimentScore: doublePrecision("sentiment_score").notNull(),
    mentionCount: integer("mention_count"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    platformIdx: index("social_mentions_platform_idx").on(table.platform),
    capturedAtIdx: index("social_mentions_captured_at_idx").on(table.capturedAt),
  })
);

export const customerDensity = pgTable(
  "customer_density",
  {
    id: text("id").primaryKey(),
    regionName: text("region_name").notNull(),
    densityScore: doublePrecision("density_score").notNull(),
    population: integer("population"),
    geom: jsonb("geom").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    regionNameIdx: index("customer_density_region_name_idx").on(table.regionName),
  })
);

export const predictions = pgTable(
  "predictions",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    expectedClaims: integer("expected_claims").notNull(),
    adjustersNeeded: integer("adjusters_needed").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    generatedAtIdx: index("predictions_generated_at_idx").on(table.generatedAt),
  })
);

export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    eventIdx: index("alerts_event_id_idx").on(table.eventId),
  })
);
