import type { BenchmarkSource, ParsedObservation } from "./types";

/**
 * Artificial Analysis: APAGADA a propósito.
 *
 * Sus términos de API gratuita dicen "internal use only; no redistribution".
 * Publicar sus índices en un sitio público ES redistribuir, así que esta fuente
 * solo debe encenderse con licencia comercial o permiso escrito de AA. El
 * adapter queda listo para ese día; mientras tanto no se muestra en la UI.
 *
 * Para encenderla: conseguir el permiso, poner ARTIFICIAL_ANALYSIS_API_KEY en
 * las variables de entorno de Convex y cambiar `enabled` a true.
 */

type Model = {
  slug?: string;
  name?: string;
  evaluations?: { artificial_analysis_coding_index?: number };
};

export function parse(body: string): ParsedObservation[] {
  const { data } = JSON.parse(body) as { data?: Model[] };
  const out: ParsedObservation[] = [];
  for (const m of data ?? []) {
    const score = m.evaluations?.artificial_analysis_coding_index;
    if (!m.slug || score === undefined) continue;
    out.push({
      sourceKey: m.slug,
      modelHint: m.slug,
      effort: "default",
      metric: "aa.coding_index",
      // El índice viene en escala 0-100.
      value: score / 100,
    });
  }
  return out;
}

export const artificialAnalysis: BenchmarkSource = {
  id: "artificial-analysis",
  kind: "benchmark",
  name: "Artificial Analysis",
  homepage: "https://artificialanalysis.ai/",
  url: "https://artificialanalysis.ai/api/v2/data/llms/models",
  attribution: "Artificial Analysis",
  license:
    "API gratuita: solo uso interno, sin redistribución. Publicar sus scores requiere licencia comercial.",
  enabled: false,
  note: "No encender sin permiso escrito de Artificial Analysis. Requiere ARTIFICIAL_ANALYSIS_API_KEY.",
  parse,
};
