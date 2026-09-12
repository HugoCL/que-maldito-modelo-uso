import type { ParsedCatalogEntry, ParsedObservation } from "../sources/types";
import { buildIndex, resolveModel } from "../matching/resolve";
import type { Candidate, CostSample, MetricSample } from "./compute";

export type SourceObservations = { sourceId: string; observations: ParsedObservation[] };

export type Unresolved = {
  sourceId: string;
  sourceKey: string;
  suggestion?: string;
  score?: number;
  timesSeen: number;
};

/**
 * Junta catálogo y mediciones en la unidad que de verdad se recomienda:
 * modelo x reasoning effort.
 *
 * Lo que no se resuelve no se adivina: sale en `unresolved` con su sugerencia
 * para que alguien lo mire. Una recomendación con el modelo equivocado hace
 * más daño que una recomendación de menos.
 */
export function buildCandidates(
  catalog: ParsedCatalogEntry[],
  sources: SourceObservations[],
): { candidates: Candidate[]; unresolved: Unresolved[] } {
  const index = buildIndex(catalog);
  const byKey = new Map(catalog.map((c) => [c.modelKey, c]));

  const metrics = new Map<string, MetricSample[]>();
  const costs = new Map<string, CostSample[]>();
  const efforts = new Map<string, { modelKey: string; effort: string }>();
  const unresolved = new Map<string, Unresolved>();

  for (const { sourceId, observations } of sources) {
    for (const o of observations) {
      const r = resolveModel(o.modelHint, index);
      if (!r.ok) {
        const key = `${sourceId}::${o.sourceKey}`;
        const prev = unresolved.get(key);
        unresolved.set(key, {
          sourceId,
          sourceKey: o.sourceKey,
          suggestion: r.suggestion,
          score: r.score,
          timesSeen: (prev?.timesSeen ?? 0) + 1,
        });
        continue;
      }

      const variantKey = `${r.modelKey}@${o.effort}`;
      efforts.set(variantKey, { modelKey: r.modelKey, effort: o.effort });

      const list = metrics.get(variantKey) ?? [];
      list.push({
        metric: o.metric,
        value: o.value,
        ciLo: o.ciLo,
        ciHi: o.ciHi,
        measuredAt: o.measuredAt,
      });
      metrics.set(variantKey, list);

      if (o.costPerTask !== undefined) {
        const cl = costs.get(variantKey) ?? [];
        cl.push({ sourceId, costPerTask: o.costPerTask });
        costs.set(variantKey, cl);
      }
    }
  }

  const candidates: Candidate[] = [];
  for (const [variantKey, { modelKey, effort }] of efforts) {
    const model = byKey.get(modelKey);
    if (!model) continue;

    // Si dos fuentes miden lo mismo, se queda la lectura más alta: cada una
    // usa su propio andamio y la más baja suele decir más del andamio que del
    // modelo. DeepSWE y CursorBench no chocan porque son métricas distintas.
    const mejorPorMetrica = new Map<string, MetricSample>();
    for (const m of metrics.get(variantKey) ?? []) {
      const prev = mejorPorMetrica.get(m.metric);
      if (!prev || m.value > prev.value) mejorPorMetrica.set(m.metric, m);
    }

    candidates.push({
      variantKey,
      modelKey,
      modelName: model.name,
      creator: model.creator,
      effort: effort as Candidate["effort"],
      metrics: [...mejorPorMetrica.values()],
      costSamples: costs.get(variantKey) ?? [],
      pricing: model.pricing,
      providers: model.providers ?? [],
      openWeights: model.openWeights,
      programmingRank: model.programmingRank,
    });
  }

  return { candidates, unresolved: [...unresolved.values()] };
}
