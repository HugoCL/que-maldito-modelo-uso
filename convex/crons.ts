import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Una vez al día, a las 6:00 UTC.
 *
 * Ninguna de las fuentes publica más de una vez al día, y varias son páginas
 * sin API que estamos leyendo de prestado: pedirles más seguido no traería
 * datos nuevos, solo ruido en sus logs.
 */
crons.daily(
  "ingesta diaria",
  { hourUTC: 6, minuteUTC: 0 },
  internal.ingest.orchestrator.runAll,
  { trigger: "cron" },
);

export default crons;
