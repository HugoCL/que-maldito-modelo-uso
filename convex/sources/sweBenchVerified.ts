import type { BenchmarkSource, ParsedObservation } from "./types";
import { normalizeEffort } from "../matching/normalize";

/**
 * SWE-bench Verified — el leaderboard oficial, servido como JSON desde el repo
 * del sitio. Es el benchmark más citado del área y por eso lo incluimos, pero
 * es el más débil de nuestras fuentes por dos razones que el scoring castiga:
 *
 *  1. Mide agente + modelo, no modelos sueltos, y los andamios varían muchísimo.
 *  2. Las entradas se han ido quedando viejas: el corte del fixture es febrero
 *     de 2026. `measuredAt` viaja con cada observación para que el peso decaiga.
 */

type Entry = {
  name?: string;
  agent?: string;
  model_display?: string;
  model_org?: string;
  reasoning_effort?: string | null;
  resolved?: number;
  cost?: number | null;
  instance_cost?: number | null;
  date?: string;
  os_model?: boolean;
};

type Board = { name?: string; results?: Entry[] };

export function parse(body: string): ParsedObservation[] {
  const doc = JSON.parse(body) as { leaderboards?: Board[] } | Board[];
  const boards = Array.isArray(doc) ? doc : (doc.leaderboards ?? []);
  const verified = boards.find((b) => (b.name ?? "").toLowerCase().includes("verified"));
  if (!verified?.results) return [];

  const best = new Map<string, ParsedObservation>();

  for (const e of verified.results) {
    const model = e.model_display;
    if (!model || e.resolved === undefined) continue;

    const effort = normalizeEffort(e.reasoning_effort ?? undefined);
    const obs: ParsedObservation = {
      sourceKey: e.name ?? `${model} (${e.agent ?? "?"})`,
      modelHint: model,
      effort,
      metric: "swebench_verified.resolved",
      value: e.resolved / 100,
      costPerTask: e.instance_cost ?? undefined,
      measuredAt: e.date,
    };

    const key = `${model}@${effort}`;
    const prev = best.get(key);
    if (!prev || obs.value > prev.value) best.set(key, obs);
  }

  return [...best.values()];
}

export const sweBenchVerified: BenchmarkSource = {
  id: "swebench-verified",
  kind: "benchmark",
  name: "SWE-bench Verified",
  homepage: "https://www.swebench.com/",
  url: "https://raw.githubusercontent.com/swe-bench/swe-bench.github.io/master/data/leaderboards.json",
  attribution: "SWE-bench Verified — Princeton NLP / SWE-bench",
  license: "Datos del leaderboard oficial, repositorio público.",
  enabled: true,
  note: "Mide agente+modelo y se actualiza despacio: el scoring le baja el peso por antigüedad.",
  parse,
};
