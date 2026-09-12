import { internalMutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Candidate } from "./compute";
import { scoreAll } from "./compute";
import { elegirTarjetas } from "./tiers";

/**
 * Arma los candidatos a partir de lo que hay en la base y guarda el resultado.
 *
 * La misma función pura que usa el script de previsualización hace el trabajo,
 * así que lo que se ve en la web y lo que se ve en la terminal no pueden
 * divergir.
 */
export async function candidatosDesdeLaBase(ctx: QueryCtx): Promise<Candidate[]> {
  const modelos = await ctx.db.query("models").collect();
  const porId = new Map(modelos.map((m) => [m._id, m]));

  const variantes = await ctx.db.query("variants").collect();
  const observaciones = await ctx.db.query("observations").collect();

  const porVariante = new Map<string, typeof observaciones>();
  for (const o of observaciones) {
    const lista = porVariante.get(o.variantId) ?? [];
    lista.push(o);
    porVariante.set(o.variantId, lista);
  }

  const candidatos: Candidate[] = [];
  for (const variante of variantes) {
    const modelo = porId.get(variante.modelId);
    const obs = porVariante.get(variante._id);
    if (!modelo || !obs?.length) continue;

    // Si dos fuentes miden la misma métrica, se queda la lectura más alta:
    // cada una usa su andamio y la más baja suele hablar del andamio, no del
    // modelo.
    const mejorPorMetrica = new Map<string, (typeof obs)[number]>();
    for (const o of obs) {
      const previo = mejorPorMetrica.get(o.metric);
      if (!previo || o.value > previo.value) mejorPorMetrica.set(o.metric, o);
    }

    candidatos.push({
      variantKey: variante.variantKey,
      modelKey: modelo.modelKey,
      modelName: modelo.name,
      creator: modelo.creator,
      effort: variante.effort,
      metrics: [...mejorPorMetrica.values()].map((o) => ({
        metric: o.metric,
        value: o.value,
        ciLo: o.ciLo,
        ciHi: o.ciHi,
        measuredAt: o.measuredAt,
      })),
      costSamples: obs
        .filter((o) => o.costPerTask !== undefined)
        .map((o) => ({ sourceId: o.sourceId, costPerTask: o.costPerTask! })),
      pricing: modelo.pricing,
      providers: modelo.providers ?? [],
      openWeights: modelo.openWeights,
      programmingRank: modelo.programmingRank,
    });
  }

  return candidatos;
}

export const recalcular = internalMutation({
  args: {},
  handler: async (ctx) => {
    const candidatos = await candidatosDesdeLaBase(ctx);
    if (candidatos.length === 0) return { candidatos: 0, tarjetas: 0 };

    const ahora = Date.now();
    // El perfil general es el que se guarda; los demás se calculan en vivo
    // cuando alguien mueve un filtro, sobre los mismos datos.
    const puntuados = scoreAll(candidatos, "general", ahora);
    const tarjetas = elegirTarjetas(puntuados);

    const variantes = await ctx.db.query("variants").collect();
    const idPorClave = new Map(variantes.map((v) => [v.variantKey, v._id]));

    for (const viejo of await ctx.db.query("scores").collect()) {
      await ctx.db.delete(viejo._id);
    }
    for (const s of puntuados) {
      const variantId = idPorClave.get(s.variantKey);
      if (!variantId) continue;
      await ctx.db.insert("scores", {
        variantId,
        quality: s.quality,
        qualityLo: s.qualityLo,
        qualityHi: s.qualityHi,
        coverage: s.coverage,
        confidence: s.confidence,
        cost: s.cost,
        costMeasured: s.costMeasured,
        costLo: s.costLo,
        costHi: s.costHi,
        blendedPrice: s.blendedPrice,
        metrics: s.metricBreakdown,
        onFrontier: false,
        computedAt: ahora,
      });
    }

    for (const viejo of await ctx.db.query("rankings").collect()) {
      await ctx.db.delete(viejo._id);
    }
    for (const t of tarjetas) {
      const variantId = idPorClave.get(t.ganador.variantKey);
      if (!variantId) continue;
      await ctx.db.insert("rankings", {
        tier: t.tier,
        variantId,
        runnerUpVariantId: t.segundo ? idPorClave.get(t.segundo.variantKey) : undefined,
        quality: t.ganador.quality,
        cost: t.ganador.cost,
        costMeasured: t.ganador.costMeasured,
        rationale: t.razon,
        computedAt: ahora,
      });
    }

    return { candidatos: candidatos.length, tarjetas: tarjetas.length };
  },
});
