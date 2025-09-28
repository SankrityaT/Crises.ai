# Crises.ai – Real-Time Emergency Intelligence Map

Crises.ai fuses disaster telemetry, 911 signals, and social sentiment to give State Farm real-time situational awareness.

## Repository Layout

```
src/
  app/
    (dashboard)/
      map/              # Frontend map surface (Engineer A)
    layout.tsx
  components/
    map/                # React-Leaflet layers & UI widgets
    ui/
  hooks/
  lib/
  store/
  types/
backend/
  ingestion/           # Pollers for USGS, Kontur, NASA, FEMA, Social
  scheduler/           # Cron runner entrypoint (Node + TS)
  services/
  sockets/
services/
  ai/                  # FastAPI ML microservice (Engineer C)
```

## Getting Started

```bash
pnpm install
pnpm dev            # Next.js frontend + API routes
pnpm backend:dev    # Node scheduler (requires env + DB)
pnpm test           # Vitest unit tests
pnpm lint           # ESLint via next lint
```

Create an `.env.local` with the following keys (full list in `.env.example`):

```
DATABASE_URL=
SUPABASE_PROJECT_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NERIS_API_KEY=
NASA_FIRMS_API_KEY=
KONTUR_API_KEY=
KONTUR_FEED_ALIAS=
FEMA_DECLARATIONS_URL=
FEMA_TOP=
FEMA_TIMEOUT_MS=
TWITTER_BEARER_TOKEN=
OPENAI_API_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_WS_URL=
USE_MOCK_DATA=true
```

## Workflow & Branch Strategy

- **Engineer A**: `feature/frontend-map`
- **Engineer B**: `feature/backend-pipeline`
- **Engineer C**: `feature/ai-alerts`

Rebase from `main` before opening PRs, keep shared types inside `src/types/`, and coordinate schema changes via quick reviews to avoid conflicts.

## Immediate TODOs

- Bootstrap Supabase/PostGIS schema and Drizzle migrations under `db/migrations/`.
- Flesh out ingestion pipelines in `backend/ingestion/` with persistence + Socket.IO push.
- Scaffold AI microservice within `services/ai/` (FastAPI) and connect predictive UI panels.
  - Update: AI insights now proxied through Next.js routes that call Gemini 1.5 Pro; ensure `GEMINI_API_KEY` is set.
