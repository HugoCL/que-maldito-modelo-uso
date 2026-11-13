import { cronJobs } from "convex/server";

// Sin trabajos: el proyecto está archivado y no hay por qué seguir leyendo
// páginas ajenas cada día. La ingesta sigue en `ingest/orchestrator:runAll`
// por si alguna vez vuelve.
const crons = cronJobs();

export default crons;
