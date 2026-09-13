/**
 * Corre todos los parsers contra los fixtures y reporta qué nombres no se
 * resuelven contra el catálogo. Es la herramienta para mantener aliases.ts.
 *
 *   npx vite-node scripts/diagnose-matching.ts
 */
import { readFileSync } from "node:fs";
import { parse as modelsDev } from "../convex/sources/modelsDev";
import { parse as cursorBench } from "../convex/sources/cursorBench";
import { parse as deepSwe } from "../convex/sources/deepSwe";
import { parse as terminalBench } from "../convex/sources/terminalBench";
import { buildIndex, resolveModel } from "../convex/matching/resolve";

const read = (f: string) => readFileSync(`tests/fixtures/${f}`, "utf8");

const catalog = modelsDev(read("modelsdev.json"));
const index = buildIndex(catalog);

const benches = [
  ["deepswe", deepSwe(read("deepswe.html"))],
  ["cursorbench", cursorBench(read("cursorbench.html"))],
  ["terminalbench", terminalBench(read("terminalbench.html"))],
] as const;

console.log(`catálogo: ${catalog.length} modelos\n`);

for (const [name, obs] of benches) {
  const unresolved: string[] = [];
  const via: Record<string, number> = {};
  for (const o of obs) {
    const r = resolveModel(o.modelHint, index);
    if (r.ok) via[r.via] = (via[r.via] ?? 0) + 1;
    else unresolved.push(`${o.modelHint}${r.suggestion ? `  ~> ${r.suggestion} (${r.score})` : ""}`);
  }
  const pct = Math.round(((obs.length - unresolved.length) / obs.length) * 100);
  console.log(`${name}: ${obs.length - unresolved.length}/${obs.length} (${pct}%)  ${JSON.stringify(via)}`);
  for (const u of [...new Set(unresolved)].sort()) console.log(`   ✗ ${u}`);
  console.log();
}
