CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis_topology;
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_density" (
	"id" text PRIMARY KEY NOT NULL,
	"region_name" text NOT NULL,
	"density_score" double precision NOT NULL,
	"population" integer,
	"geom" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'moderate' NOT NULL,
	"magnitude" double precision,
	"occurred_at" timestamp with time zone NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"depth" double precision,
	"risk_score" double precision,
	"customer_density_id" text,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"expected_claims" integer NOT NULL,
	"adjusters_needed" integer NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "social_mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"content" text NOT NULL,
	"sentiment_score" double precision NOT NULL,
	"mention_count" integer,
	"latitude" double precision,
	"longitude" double precision,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_event_id_idx" ON "alerts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "customer_density_region_name_idx" ON "customer_density" USING btree ("region_name");--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "events_source_idx" ON "events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "predictions_generated_at_idx" ON "predictions" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "social_mentions_platform_idx" ON "social_mentions" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "social_mentions_captured_at_idx" ON "social_mentions" USING btree ("captured_at");
