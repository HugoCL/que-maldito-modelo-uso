import type { BenchmarkSource, ParsedObservation } from "./types";
import { splitEffort } from "../matching/normalize";

/**
 * CursorBench 4.0: tareas ambiguas y multi-archivo sacadas de sesiones reales
 * de Cursor. La página se renderiza en el servidor, así que la tabla completa
 * viene en el HTML: rank, modelo, score, costo/tarea, tokens/tarea, pasos/tarea.
 *
 * Leemos la tabla y no las etiquetas del gráfico: el gráfico solo dibuja la
 * frontera (32 puntos) mientras que la tabla trae las 43 configuraciones.
 */

/** Quita etiquetas y los comentarios que React deja entre texto y sufijo. */
function cellText(html: string): string {
  return html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function toNumber(raw: string): number | undefined {
  const n = Number(raw.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function parse(body: string): ParsedObservation[] {
  const out: ParsedObservation[] = [];
  const seen = new Set<string>();

  // La página repite la tabla (una variante para móvil y otra para escritorio).
  for (const tbody of body.match(/<tbody[^>]*>[\s\S]*?<\/tbody>/g) ?? []) {
    for (const rowHtml of tbody.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
      const cells = (rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(cellText);
      if (cells.length < 4) continue;

      const [, label, scoreRaw, costRaw, tokensRaw, stepsRaw] = cells;
      const score = toNumber(scoreRaw);
      if (!label || score === undefined) continue;

      const { base, effort } = splitEffort(label);
      const sourceKey = label;
      if (seen.has(sourceKey)) continue;
      seen.add(sourceKey);

      out.push({
        sourceKey,
        modelHint: base,
        effort,
        metric: "cursorbench.score",
        value: score / 100,
        costPerTask: costRaw ? toNumber(costRaw) : undefined,
        outputTokens: tokensRaw ? toNumber(tokensRaw) : undefined,
        agentSteps: stepsRaw ? toNumber(stepsRaw) : undefined,
      });
    }
  }
  return out;
}

export const cursorBench: BenchmarkSource = {
  id: "cursorbench",
  kind: "benchmark",
  name: "CursorBench 4.0",
  homepage: "https://cursor.com/cursorbench",
  url: "https://cursor.com/cursorbench",
  attribution: "CursorBench 4.0, de Cursor",
  license: "Leaderboard público; robots.txt permite /cursorbench explícitamente.",
  enabled: true,
  parse,
};
