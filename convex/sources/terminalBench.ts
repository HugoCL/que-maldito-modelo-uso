import type { BenchmarkSource, ParsedObservation } from "./types";
import { normalizeEffort } from "../matching/normalize";

/**
 * Terminal-Bench 2.0 (Stanford / Harbor / Laude Institute) — tareas de terminal
 * de punta a punta: compilar, administrar servidores, ciencia de datos.
 *
 * La página es Next.js y serializa las filas en el payload de flight con las
 * comillas escapadas. Al desescapar queda JSON legible.
 *
 * Ojo con la lectura: cada fila es agente + modelo (Codex, Claude Code,
 * Terminus...), así que mide la pareja y no el modelo solo. Nos quedamos con el
 * mejor resultado de cada modelo+effort, que es la pregunta que le interesa a
 * quien elige modelo: de lo que este modelo es capaz, ¿cuánto es?
 */

type Row = {
  metadata?: {
    date?: string;
    reasoning_effort?: string;
    model_display?: { label?: string };
    agent_display?: { label?: string };
  };
  metrics?: {
    accuracy?: number;
    accuracy_ci95_half_width?: number;
    n_trials?: number;
    total_cost_usd?: number;
    output_tokens?: number;
    avg_trial_duration_sec?: number;
  };
  n_trials?: number;
};

export function parse(body: string): ParsedObservation[] {
  const unescaped = body.replace(/\\"/g, '"');
  const best = new Map<string, ParsedObservation>();

  // Las filas viven sueltas dentro del payload; las leemos una por una en vez
  // de intentar reconstruir el documento completo, que trae otras cosas.
  const blocks = unescaped.match(/\{"id":"[^"]+","leaderboard_id":"[^"]+",[\s\S]*?"n_trials":\d+\}/g) ?? [];

  for (const block of blocks) {
    let row: Row;
    try {
      row = JSON.parse(block) as Row;
    } catch {
      continue;
    }
    const label = row.metadata?.model_display?.label;
    const accuracy = row.metrics?.accuracy;
    if (!label || accuracy === undefined) continue;

    const effort = normalizeEffort(row.metadata?.reasoning_effort);
    const agent = row.metadata?.agent_display?.label ?? "?";
    const trials = row.metrics?.n_trials ?? row.n_trials;
    const half = row.metrics?.accuracy_ci95_half_width;

    const obs: ParsedObservation = {
      sourceKey: `${label}@${row.metadata?.reasoning_effort ?? "default"} (${agent})`,
      modelHint: label,
      effort,
      metric: "terminalbench.accuracy",
      value: accuracy / 100,
      ciLo: half !== undefined ? Math.max(0, (accuracy - half) / 100) : undefined,
      ciHi: half !== undefined ? Math.min(1, (accuracy + half) / 100) : undefined,
      // total_cost_usd es el costo de la corrida entera, no de una tarea.
      costPerTask:
        row.metrics?.total_cost_usd !== undefined && trials
          ? row.metrics.total_cost_usd / trials
          : undefined,
      durationSeconds: row.metrics?.avg_trial_duration_sec,
      outputTokens:
        row.metrics?.output_tokens !== undefined && trials
          ? row.metrics.output_tokens / trials
          : undefined,
      measuredAt: row.metadata?.date,
    };

    const key = `${label}@${effort}`;
    const prev = best.get(key);
    if (!prev || obs.value > prev.value) best.set(key, obs);
  }

  return [...best.values()];
}

export const terminalBench: BenchmarkSource = {
  id: "terminalbench",
  kind: "benchmark",
  name: "Terminal-Bench 2.0",
  homepage: "https://www.tbench.ai/leaderboard/terminal-bench/2.0",
  url: "https://www.tbench.ai/leaderboard/terminal-bench/2.0",
  attribution: "Terminal-Bench 2.0 — Stanford / Harbor / Laude Institute",
  license: "Leaderboard público; el sitio no publica robots.txt y marca noindex.",
  enabled: true,
  note: "Un fetch al día, User-Agent identificable. Cada fila es agente+modelo: nos quedamos con el mejor por modelo.",
  parse,
};
