import type { BenchmarkSource, ParsedObservation } from "./types";
import { normalizeEffort } from "../matching/normalize";

/**
 * Terminal-Bench (Stanford / Harbor / Laude Institute): tareas de terminal de
 * punta a punta: compilar, administrar servidores, ciencia de datos.
 *
 * La página es Next.js y serializa las filas en el payload de flight con las
 * comillas escapadas. Al desescapar queda JSON legible.
 *
 * Solo sirve la versión vigente, y la sirve en la raíz: las direcciones por
 * versión (`/leaderboard/terminal-bench/2.0`) devuelven un 308 a `/?version=`
 * y el payload que llega es el de la última de todas formas, porque el cambio
 * de versión lo hace el cliente. O sea que pedir una versión antigua desde el
 * servidor no devuelve esa versión: devuelve la nueva con el nombre viejo.
 * Por eso se pide la raíz y se comprueba qué versión vino.
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

/**
 * La versión del leaderboard que este archivo sabe leer y que la web nombra.
 *
 * Va aquí arriba y se comprueba contra lo que traiga la página porque el sitio
 * publica una sola versión: el día que salga la siguiente, la raíz empieza a
 * servirla sin avisar y, sin esta comprobación, seguiríamos publicando sus
 * cifras con el nombre de la anterior. Ya pasó una vez.
 */
export const VERSION = "Terminal-Bench 4.0";

export function parse(body: string): ParsedObservation[] {
  const unescaped = body.replace(/\\"/g, '"');
  const best = new Map<string, ParsedObservation>();

  // Preferimos quedarnos un día sin esta fuente a atribuirle a una versión
  // números de otra. El fallo sale en /estado con las dos versiones escritas,
  // que es todo lo que hace falta para arreglarlo: cambiar VERSION y mirar si
  // el resto del parser sigue valiendo.
  const publicada = unescaped.match(/"title":"(Terminal-Bench [\d.]+)"/)?.[1];
  if (publicada !== undefined && publicada !== VERSION) {
    throw new Error(
      `Terminal-Bench publica ahora ${publicada} y aquí se declara ${VERSION}. ` +
        "Revisa convex/sources/terminalBench.ts antes de seguir ingiriendo.",
    );
  }

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
  name: VERSION,
  homepage: "https://www.tbench.ai/",
  url: "https://www.tbench.ai/",
  attribution: `${VERSION}, de Stanford / Harbor / Laude Institute`,
  license: "Leaderboard público; el sitio no publica robots.txt y marca noindex.",
  enabled: true,
  note: "Un fetch al día, User-Agent identificable. Cada fila es agente+modelo: nos quedamos con el mejor por modelo. El sitio solo sirve la versión vigente: si sube de versión, la ingesta falla en vez de renombrar sola los números.",
  parse,
};
