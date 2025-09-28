import "dotenv/config";

import cron, { ScheduledTask } from "node-cron";

import { ingestUSGS } from "../ingestion/usgs";
import { ingestKontur } from "../ingestion/kontur";
import { ingestNasaFirms } from "../ingestion/nasaFirms";
import { ingestFEMA } from "../ingestion/fema";
import { ingestSocial } from "../ingestion/social";
import { closeDb } from "../services/db";
import { invalidateCustomerDensityCache } from "../services/riskScore";
import { removeAllListeners, shutdownSocketEmitter } from "../services/socketEmitter";

const registeredTasks: ScheduledTask[] = [];

function scheduleJob(
  label: string,
  expression: string,
  handler: () => Promise<void>
): void {
  const task = cron.schedule(expression, async () => {
    console.log(
      `[Scheduler] Running ${label} ingestion at ${new Date().toISOString()}`
    );

    try {
      await handler();
    } catch (error) {
      console.error(`[Scheduler] ${label} ingestion failed`, error);
    }
  });

  registeredTasks.push(task);
  console.log(`[Scheduler] ${label} scheduled with expression '${expression}'.`);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[Scheduler] Received ${signal}. Commencing graceful shutdown…`);

  for (const task of registeredTasks) {
    task.stop();
  }

  try {
    await shutdownSocketEmitter();
    removeAllListeners();
  } catch (error) {
    console.warn("[Scheduler] Error while shutting down socket emitter", error);
  }

  try {
    await closeDb();
  } catch (error) {
    console.warn("[Scheduler] Error while closing database connections", error);
  }

  invalidateCustomerDensityCache();

  console.log("[Scheduler] Shutdown complete. Bye.");
  process.exit(0);
}

function registerSignalHandlers(): void {
  (['SIGINT', 'SIGTERM'] as NodeJS.Signals[]).forEach((signal) => {
    process.on(signal, () => {
      shutdown(signal).catch((error) => {
        console.error("[Scheduler] Failed to shutdown cleanly", error);
        process.exit(1);
      });
    });
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Scheduler] Unhandled promise rejection", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("[Scheduler] Uncaught exception", error);
  });
}

async function runBootSequence(): Promise<void> {
  console.log("[Scheduler] CrisisLens ingestion scheduler booting…");
  console.log(
    `[Scheduler] USE_MOCK_DATA=${process.env.USE_MOCK_DATA ?? "false"}. DATABASE_URL ${
      process.env.DATABASE_URL ? "configured" : "not configured"
    }.`
  );

  scheduleJob(
    "USGS",
    process.env.USGS_CRON_EXPRESSION ?? "*/5 * * * *",
    ingestUSGS
  );

  scheduleJob(
    "Kontur",
    process.env.KONTUR_CRON_EXPRESSION ?? "*/7 * * * *",
    ingestKontur
  );

  scheduleJob(
    "NASA FIRMS",
    process.env.NASA_FIRMS_CRON_EXPRESSION ?? "*/10 * * * *",
    ingestNasaFirms
  );

  scheduleJob(
    "FEMA",
    process.env.FEMA_CRON_EXPRESSION ?? "*/3 * * * *",
    ingestFEMA
  );

  scheduleJob(
    "Social",
    process.env.SOCIAL_CRON_EXPRESSION ?? "*/2 * * * *",
    ingestSocial
  );

  registerSignalHandlers();

  console.log("[Scheduler] Triggering initial ingestion sweep.");
  await Promise.allSettled([
    ingestUSGS(),
    ingestKontur(),
    ingestNasaFirms(),
    ingestFEMA(),
    ingestSocial(),
  ]);

  console.log("[Scheduler] Scheduler ready. Use CTRL+C to exit.");
}

runBootSequence().catch((error) => {
  console.error("[Scheduler] Fatal error", error);
  process.exit(1);
});
