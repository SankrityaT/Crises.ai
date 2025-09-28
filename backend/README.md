# Backend Pipeline (Engineer B)

This package hosts the data ingestion jobs, schedulers, and real-time delivery layers that power CrisisLens. The workers run in Node.js (via `tsx`) and rely on Supabase/PostgreSQL + PostGIS for persistence.

```
backend/
  ingestion/      // Source-specific fetchers (USGS, Kontur, NASA, FEMA, Social)
  scheduler/      // Cron runners orchestrating ingestion cadence
  services/       // Risk scoring, persistence helpers, Socket bridge
  sockets/        // (Reserved) Socket.IO server bridge and Redis listeners
```

## Environment

1. Copy `.env.example` → `.env.local` and populate values.
2. Ensure `DATABASE_URL` points at the Supabase Postgres instance with PostGIS enabled. Local dev can use `docker` Postgres.
3. Optional extras:
   - `USGS_API_URL`, `USGS_TIMEOUT_MS`, `USGS_CRON_EXPRESSION` to tweak earthquake polling.
   - `KONTUR_*`, `NASA_FIRMS_*`, `FEMA_*`, `SOCIAL_*` knobs to control other data feeds.
   - `USE_MOCK_DATA=true` to bypass network calls and rely on `data/mock/` fixtures.
   - `REDIS_URL`/`REDIS_TOKEN` when wiring Socket.IO through Upstash Redis.

## Database & Migrations

Drizzle ORM manages schema + migrations under `db/`.

```bash
pnpm drizzle:generate   # produces SQL from schema definitions
pnpm drizzle:push       # runs migrations against DATABASE_URL
pnpm drizzle:studio     # optional: inspect data via Drizzle Studio
```

Tables created on boot:
- `events`
- `social_mentions`
- `customer_density`
- `predictions`
- `alerts`

### Seed Customer Density Polygons

Sample GeoJSON polygons live in `data/mock/customer_density.geojson`. Seed them into the database (or refresh) via:

```bash
pnpm seed:customer-density
```

This script upserts the polygons and keeps the `customer_density` cache warm for risk scoring.

## Ingestion Flow

1. `backend/ingestion/*.ts` poll their respective feeds (USGS, Kontur, NASA FIRMS, FEMA declarations, Social) or load fixtures when `USE_MOCK_DATA=true`.
2. `backend/services/riskScore.ts` enriches every normalized event with customer density overlays and risk scoring heuristics.
3. `backend/services/eventRepository.ts` persists events, while `backend/services/socialRepository.ts` stores social mentions.
4. `backend/services/socketEmitter.ts` publishes real-time payloads over four channels (`map.events`, `map.rapid`, `map.social`, `map.predictions`) to Redis + in-process listeners.

## Scheduler Worker

Run the scheduler locally:

```bash
pnpm backend:dev
```

Behaviour highlights:
- Boot logs indicate whether persistence is enabled and if mock mode is active.
- Registers cron jobs for all sources (USGS, Kontur, NASA FIRMS, FEMA, Social) and immediately performs a bootstrap ingestion sweep.
- Graceful shutdown hooks stop cron tasks, dispose of DB / Redis connections, and clear caches.

### Socket.IO + Bootstrap APIs

- `src/app/api/socket/io.ts` spins up the Socket.IO server and bridges either Redis pub/sub or the in-memory emitter.
- `src/app/api/map/bootstrap/route.ts` builds a snapshot payload (`MapBootstrapPayload`) combining latest events, rapid call clusters, social hotspots, predictions, and customer density regions.

## Mock Fixtures

`data/mock/` contains deterministic payloads used when `USE_MOCK_DATA=true`:
- `usgs-feed.json` – sample earthquake feed
- `kontur-events.json` – sample severe weather polygons
- `nasa-firms.json` – sample wildfire detections
- `fema-declarations.json` – sample disaster declaration data
- `social-mentions.json` – sample geo-tagged social chatter
- `predictions.json` – sample claims & adjuster predictions
- `customer_density.geojson` – sample polygons for risk overlay and seeding

## Testing

Unit tests cover normalization and risk scoring heuristics.

```bash
pnpm test
```

Add new ingestion modules with their own normalization helpers + tests before wiring into the scheduler.
