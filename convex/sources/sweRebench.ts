import type { BenchmarkSource, ParsedObservation } from "./types";
import { splitEffort } from "../matching/normalize";

/**
 * SWE-rebench — tareas nuevas extraídas de PRs recientes, mes a mes. Es la
 * única fuente que da una señal resistente a contaminación: si un modelo
 * memorizó SWE-bench, aquí no le sirve de nada.
 *
 * La página es Next.js y trae los datos en el payload de flight con las
 * comillas escapadas. Cada item guarda una serie de ventanas acumuladas
 * ("desde:hasta"); nos quedamos con la más ancha, que es la más reciente.
 */

type Window = {
  resolvedRate?: number;
  sem?: number;
  passN?: number;
  instanceCosts?: number;
};

/**
 * `rangeStats` trae un grupo "all" y además uno por lenguaje (go, java, rust,
 * python, typescript). Solo el primero es el resultado global; los otros
 * terminan en ventanas vacías que, si se leen por descuido, tapan el dato real.
 */
function allGroup(chunk: string): string | null {
  const marker = '"rangeStats":{"all":';
  const at = chunk.indexOf(marker);
  if (at === -1) return null;

  let i = at + marker.length;
  let depth = 0;
  for (; i < chunk.length; i++) {
    if (chunk[i] === "{") depth++;
    else if (chunk[i] === "}") {
      depth--;
      if (depth === 0) return chunk.slice(at + marker.length, i + 1);
    }
  }
  return null;
}

/**
 * La ventana más ancha que tenga datos. Las últimas pueden venir en cero
 * porque el mes todavía no se ha corrido, y un cero no es un 0% real.
 */
function latestWindow(chunk: string): { window: Window; to: number } | null {
  const group = allGroup(chunk);
  if (!group) return null;

  let best: { window: Window; to: number } | null = null;
  const re = /"(\d+):(\d+)":(\{[^{}]*\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(group)) !== null) {
    const to = Number(m[2]);
    if (best && to <= best.to) continue;
    try {
      const window = JSON.parse(m[3]) as Window;
      if (!window.resolvedRate) continue;
      best = { window, to };
    } catch {
      // ventana ilegible: se ignora y seguimos con las demás
    }
  }
  return best;
}

function field(chunk: string, key: string): string | undefined {
  return chunk.match(new RegExp(`"${key}":"([^"]*)"`))?.[1];
}

export function parse(body: string): ParsedObservation[] {
  const unescaped = body.replace(/\\"/g, '"');
  const start = unescaped.indexOf('"items":[');
  if (start === -1) return [];

  const chunks = unescaped.slice(start).split('{"modelId":"').slice(1);
  const best = new Map<string, ParsedObservation>();

  for (const chunk of chunks) {
    const name = field(chunk, "modelName");
    // El tablero mezcla modelos con agentes completos (Cursor, Codex, Claude
    // Code). Solo nos sirven los modelos.
    if (!name || field(chunk, "instance_type") !== "model") continue;

    const latest = latestWindow(chunk);
    if (!latest || !latest.window.resolvedRate) continue;

    const { base, effort } = splitEffort(name);
    // `sem` es el error estándar en puntos porcentuales; 1.96 sem = IC del 95%.
    const rate = latest.window.resolvedRate / 100;
    const sem = latest.window.sem !== undefined ? (1.96 * latest.window.sem) / 100 : undefined;
    const costs = latest.window.instanceCosts;

    const obs: ParsedObservation = {
      sourceKey: name,
      modelHint: base,
      effort,
      metric: "swerebench.resolved_rate",
      value: rate,
      ciLo: sem !== undefined ? Math.max(0, rate - sem) : undefined,
      ciHi: sem !== undefined ? Math.min(1, rate + sem) : undefined,
      // instanceCosts llega en 0 cuando no la midieron; 0 no es un costo real.
      costPerTask: costs && costs > 0 ? costs : undefined,
      measuredAt: new Date(latest.to).toISOString().slice(0, 10),
    };

    // El mismo modelo aparece con andamio "text" y "tools": vale el mejor.
    const key = `${base}@${effort}`;
    const prev = best.get(key);
    if (!prev || obs.value > prev.value) best.set(key, obs);
  }

  return [...best.values()];
}

export const sweRebench: BenchmarkSource = {
  id: "swerebench",
  kind: "benchmark",
  name: "SWE-rebench",
  homepage: "https://swe-rebench.com/leaderboard",
  url: "https://swe-rebench.com/leaderboard",
  attribution: "SWE-rebench — Nebius",
  license: "Leaderboard público; robots.txt permite crawling.",
  enabled: true,
  note: "Tareas nuevas cada mes: la única señal del conjunto que resiste contaminación.",
  parse,
};
