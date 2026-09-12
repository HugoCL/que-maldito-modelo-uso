import type { BenchmarkSource, ParsedObservation } from "./types";
import { normalizeEffort } from "../matching/normalize";

/**
 * DeepSWE v1.1 (Datacurve) — 113 tareas largas en 91 repos, 5 lenguajes.
 *
 * La página es TanStack Start y serializa los resultados en el blob de
 * hidratación como literales de objeto JavaScript (claves sin comillas,
 * referencias `$R[n]=[...]`), así que no sirve JSON.parse. El scanner de abajo
 * lee pares clave:valor respetando comillas y corchetes.
 *
 * Es la fuente más rica que encontramos: intervalos de confianza sobre 4
 * corridas completas, costo real por tarea, y un único harness
 * (mini-swe-agent) para todos los modelos — o sea que compara modelos, no
 * andamios.
 */

type Record_ = Map<string, string | number | null>;

/** Lee `{clave:valor,...}` tolerando comillas, corchetes y `$R[n]=`. */
function scanRecord(src: string): Record_ {
  const out: Record_ = new Map();
  let i = 0;
  const n = src.length;

  while (i < n) {
    while (i < n && (src[i] === "," || src[i] === "{" || src[i] === " ")) i++;
    if (i >= n || src[i] === "}") break;

    const keyStart = i;
    while (i < n && src[i] !== ":") i++;
    const key = src.slice(keyStart, i).replace(/^"|"$/g, "");
    i++; // el ':'

    let value: string | number | null = null;

    if (src[i] === '"') {
      i++;
      const start = i;
      while (i < n && !(src[i] === '"' && src[i - 1] !== "\\")) i++;
      value = src.slice(start, i);
      i++; // la comilla de cierre
    } else {
      const start = i;
      let depth = 0;
      while (i < n) {
        const c = src[i];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if ((c === "," || c === "}") && depth === 0) break;
        i++;
      }
      const raw = src.slice(start, i).trim();
      if (raw === "null" || raw === "") value = null;
      else if (raw.startsWith("$R[")) value = raw; // arreglo por referencia
      else {
        const num = Number(raw);
        value = Number.isFinite(num) ? num : raw;
      }
    }
    out.set(key, value);
  }
  return out;
}

function num(r: Record_, key: string): number | undefined {
  const v = r.get(key);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(r: Record_, key: string): string | undefined {
  const v = r.get(key);
  return typeof v === "string" ? v : undefined;
}

export function parse(body: string): ParsedObservation[] {
  // Cada registro empieza en `{model:"` y no anida llaves.
  const blocks = body.match(/\{model:"[^"]+",[^{}]*?\}/g) ?? [];
  const out: ParsedObservation[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const r = scanRecord(block);
    const model = str(r, "model");
    const passAt1 = num(r, "pass_at_1") ?? num(r, "pass_rate");
    if (!model || passAt1 === undefined) continue;

    const effort = normalizeEffort(str(r, "reasoning_effort"));
    const sourceKey = `${model}@${str(r, "reasoning_effort") ?? "default"}`;
    // El blob repite registros entre el gráfico y la tabla.
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);

    out.push({
      sourceKey,
      modelHint: model,
      effort,
      metric: "deepswe.pass_at_1",
      value: passAt1,
      ciLo: num(r, "ci_lo"),
      ciHi: num(r, "ci_hi"),
      nRuns: num(r, "n_runs"),
      // La mediana sobre 4 corridas aguanta mejor las tareas atípicas caras.
      costPerTask: num(r, "median_cost_usd") ?? num(r, "mean_cost_usd"),
      agentSteps: num(r, "mean_agent_steps"),
      durationSeconds: num(r, "median_duration_seconds"),
      inputTokens: num(r, "mean_input_tokens"),
      cacheReadTokens: num(r, "mean_cache_read_tokens") ?? num(r, "mean_cache_tokens"),
      outputTokens: num(r, "mean_output_tokens"),
    });
  }
  return out;
}

export const deepSwe: BenchmarkSource = {
  id: "deepswe",
  kind: "benchmark",
  name: "DeepSWE v1.1",
  homepage: "https://deepswe.datacurve.ai/",
  url: "https://deepswe.datacurve.ai/",
  attribution: "DeepSWE v1.1 — Datacurve",
  license:
    "Leaderboard público. robots.txt permite crawling general; bloquea solo crawlers de entrenamiento.",
  enabled: true,
  note: "Un fetch al día, User-Agent identificable, atribución con enlace en cada tarjeta.",
  parse,
};
