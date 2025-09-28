# Backend Pipeline (Engineer B)

This package hosts the data ingestion jobs, schedulers, and real-time delivery layers that power Crises.ai.

```
backend/
  ingestion/      // Source-specific fetchers (USGS, Kontur, NASA, RapidSOS, Social)
  scheduler/      // Cron runners orchestrating ingestion cadence
  services/       // Risk scoring, prediction orchestration helpers
  sockets/        // Socket.IO server bridge and Redis pub/sub listeners
```

## Quick Start

1. Copy `.env.example` to `.env.local` and provide database/API keys.
2. Run database migrations via Drizzle: `pnpm drizzle-kit generate && pnpm drizzle-kit push`.
3. Start the scheduler worker (coming soon): `pnpm backend:dev`.

> NOTE: All networked calls should respect `USE_MOCK_DATA=true` to fall back on fixtures under `data/mock/` for demos.
