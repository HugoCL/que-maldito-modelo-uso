/**
 * Corre el pipeline completo contra los fixtures y enseña las tres tarjetas.
 * Es la prueba de olfato: si una recomendación se ve absurda, el problema
 * está en convex/scoring/config.ts.
 *
 *   npx vite-node scripts/preview-recomendaciones.ts [perfil]
 */
import { readFileSync } from "node:fs";
import { parse as modelsDev } from "../convex/sources/modelsDev";
import { parseProgramming } from "../convex/sources/openRouter";
import { parse as cursorBench } from "../convex/sources/cursorBench";
import { parse as deepSwe } from "../convex/sources/deepSwe";
import { parse as terminalBench } from "../convex/sources/terminalBench";
import { parse as sweRebench } from "../convex/sources/sweRebench";
import { parse as sweBenchVerified } from "../convex/sources/sweBenchVerified";
import { buildCandidates } from "../convex/scoring/candidates";
import { scoreAll } from "../convex/scoring/compute";
import { elegibles, elegirTarjetas, paretoFrontier } from "../convex/scoring/tiers";
import type { PerfilId } from "../convex/scoring/config";

const read = (f: string) => readFileSync(`tests/fixtures/${f}`, "utf8");
const perfil = (process.argv[2] ?? "general") as PerfilId;

const catalog = modelsDev(read("modelsdev.json"));
const rank = new Map(
  parseProgramming(read("openrouter-programming.json")).map((r) => [r.modelKey, r.programmingRank]),
);
for (const c of catalog) c.programmingRank = rank.get(c.modelKey);

const { candidates, unresolved } = buildCandidates(catalog, [
  { sourceId: "deepswe", observations: deepSwe(read("deepswe.html")) },
  { sourceId: "cursorbench", observations: cursorBench(read("cursorbench.html")) },
  { sourceId: "terminalbench", observations: terminalBench(read("terminalbench.html")) },
  { sourceId: "swerebench", observations: sweRebench(read("swerebench.html")) },
  { sourceId: "swebench-verified", observations: sweBenchVerified(read("swebench.json")) },
]);

const scored = scoreAll(candidates, perfil);
const pool = elegibles(scored);
const frontier = new Set(paretoFrontier(pool));

console.log(`perfil: ${perfil}`);
console.log(`candidatos: ${candidates.length}   elegibles (cobertura suficiente): ${pool.length}   sin resolver: ${unresolved.length}`);
console.log(`en la frontera de Pareto: ${frontier.size}\n`);

const TITULOS = {
  barato: "BARATO — mantenimiento y bajo riesgo",
  dia_a_dia: "DÍA A DÍA — el que dejas puesto",
  bueno: "NECESITO UNO BUENO — sin mirar el precio",
} as const;

for (const r of elegirTarjetas(scored)) {
  const g = r.ganador;
  console.log(`▐ ${TITULOS[r.tier]}`);
  console.log(`  ${g.modelName}${g.effort !== "default" ? ` · effort ${g.effort}` : ""}  (${g.creator})`);
  console.log(
    `  calidad ${g.quality.toFixed(1)} [${g.qualityLo.toFixed(1)}–${g.qualityHi.toFixed(1)}]` +
      `   costo $${g.cost?.toFixed(2)}/tarea ${g.costMeasured ? "(medido)" : "(estimado)"}` +
      `   cobertura ${(g.coverage * 100).toFixed(0)}% · confianza ${g.confidence}`,
  );
  console.log(`  ${r.razon}`);
  console.log(`  fuentes: ${g.metricBreakdown.map((m) => m.metric.split(".")[0]).join(", ")}`);
  if (r.segundo) console.log(`  alternativa: ${r.segundo.modelName} (${r.segundo.effort})`);
  console.log();
}

console.log("— frontera completa —");
for (const s of [...frontier].sort((a, b) => b.quality - a.quality)) {
  console.log(
    `  ${s.quality.toFixed(1).padStart(5)}  $${s.cost!.toFixed(2).padStart(6)}  ` +
      `${s.modelName} ${s.effort !== "default" ? `(${s.effort})` : ""}`,
  );
}
