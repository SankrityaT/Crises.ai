import cron from "node-cron";

import { ingestUSGS } from "../ingestion/usgs";

async function runBootSequence() {
  console.log("[Scheduler] CrisisLens ingestion scheduler booting…");

  cron.schedule("*/5 * * * *", async () => {
    console.log("[Scheduler] Running USGS ingestion cycle");
    await ingestUSGS();
  });

  console.log("[Scheduler] Schedules registered. Use CTRL+C to exit.");
}

runBootSequence().catch((error) => {
  console.error("[Scheduler] Fatal error", error);
  process.exit(1);
});
