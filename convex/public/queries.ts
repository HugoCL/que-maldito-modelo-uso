import { v } from "convex/values";
import { query } from "../_generated/server";
import { candidatosDesdeLaBase } from "../scoring/recompute";
import { scoreAll, type Scored } from "../scoring/compute";
import { elegibles, elegirTarjetas, paretoFrontier } from "../scoring/tiers";
import {
  METRICAS_ACTIVAS,
  METRIC_CONFIG,
  PERFILES,
  THRESHOLDS,
  TOKEN_MIX,
  pesosDelPerfil,
  type PerfilId,
} from "../scoring/config";
import { SOURCES } from "../sources/registry";

const perfilValidator = v.union(
  v.literal("general"),
  v.literal("mantenimiento"),
  v.literal("agentico"),
);

const filtros = {
  perfil: v.optional(perfilValidator),
  /** Solo modelos disponibles en alguno de estos proveedores. */
  proveedores: v.optional(v.array(v.string())),
  soloOpenWeights: v.optional(v.boolean()),
  /** Techo de USD por tarea. */
  presupuestoMax: v.optional(v.number()),
};

function aplicarFiltros(
  puntuados: Scored[],
  args: {
    proveedores?: string[];
    soloOpenWeights?: boolean;
    presupuestoMax?: number;
  },
): Scored[] {
  return puntuados.filter((s) => {
    if (args.soloOpenWeights && !s.openWeights) return false;
    if (args.presupuestoMax !== undefined && (s.cost ?? Infinity) > args.presupuestoMax) return false;
    if (args.proveedores?.length && !args.proveedores.some((p) => s.providers.includes(p))) {
      return false;
    }
    return true;
  });
}

/** Lo que necesita una tarjeta para dibujarse, sin nada de más. */
function aTarjeta(s: Scored) {
  return {
    variantKey: s.variantKey,
    modelKey: s.modelKey,
    modelName: s.modelName,
    creator: s.creator,
    effort: s.effort,
    quality: Math.round(s.quality * 10) / 10,
    qualityLo: Math.round(s.qualityLo * 10) / 10,
    qualityHi: Math.round(s.qualityHi * 10) / 10,
    coverage: Math.round(s.coverage * 100) / 100,
    benchmarks: s.benchmarks,
    confidence: s.confidence,
    cost: s.cost !== undefined ? Math.round(s.cost * 100) / 100 : undefined,
    costMeasured: s.costMeasured,
    costLo: s.costLo,
    costHi: s.costHi,
    blendedPrice: s.blendedPrice,
    openWeights: s.openWeights,
    providers: s.providers,
    programmingRank: s.programmingRank,
    metricas: s.metricBreakdown.map((m) => ({
      metric: m.metric,
      etiqueta: METRIC_CONFIG[m.metric].label,
      valor: Math.round(m.value * 1000) / 10,
      peso: Math.round(m.weight * 100) / 100,
    })),
  };
}

/**
 * Las tres respuestas, recalculadas con los filtros puestos.
 *
 * Los filtros NO son un recorte cosmético sobre un resultado precalculado: se
 * vuelve a elegir la frontera, el codo y las tres tarjetas sobre el
 * subconjunto. Por eso "solo lo que corre en mi proveedor" da una respuesta
 * genuina y no "lo mejor que quedó".
 *
 * Lo que no se recalcula son los límites de normalización, que salen siempre
 * del universo completo: si no, la calidad de un modelo cambiaría de número al
 * mover un filtro.
 */
export const recomendaciones = query({
  args: filtros,
  handler: async (ctx, args) => {
    const perfil: PerfilId = args.perfil ?? "general";
    const candidatos = await candidatosDesdeLaBase(ctx);
    const puntuados = scoreAll(candidatos, perfil);
    const filtrados = aplicarFiltros(puntuados, args);

    const tarjetas = elegirTarjetas(filtrados);
    const pool = elegibles(filtrados);
    const frontera = paretoFrontier(pool);

    const ultima = await ctx.db
      .query("ingestRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .first();

    return {
      perfil,
      perfilEtiqueta: PERFILES[perfil].label,
      actualizado: ultima?.finishedAt ?? ultima?.startedAt ?? null,
      totales: {
        candidatos: candidatos.length,
        elegibles: pool.length,
        enFrontera: frontera.length,
      },
      tarjetas: tarjetas.map((t) => ({
        tier: t.tier,
        razon: t.razon,
        razonCorta: t.razonCorta,
        ganador: aTarjeta(t.ganador),
        alternativas: t.alternativas.map(aTarjeta),
      })),
      frontera: frontera
        .sort((a, b) => b.quality - a.quality)
        .map(aTarjeta),
    };
  },
});

/** Todo lo puntuado, para el comparador. Incluye lo de confianza baja. */
export const listaVariantes = query({
  args: { perfil: v.optional(perfilValidator) },
  handler: async (ctx, { perfil = "general" }) => {
    const candidatos = await candidatosDesdeLaBase(ctx);
    const puntuados = scoreAll(candidatos, perfil);
    const enFrontera = new Set(paretoFrontier(elegibles(puntuados)));
    return puntuados
      .sort((a, b) => b.quality - a.quality)
      .map((s) => ({ ...aTarjeta(s), enFrontera: enFrontera.has(s) }));
  },
});

/** Ficha de un modelo: todas sus variantes y el desglose por benchmark. */
export const modelo = query({
  args: { modelKey: v.string(), perfil: v.optional(perfilValidator) },
  handler: async (ctx, { modelKey, perfil = "general" }) => {
    const m = await ctx.db
      .query("models")
      .withIndex("by_modelKey", (q) => q.eq("modelKey", modelKey))
      .unique();
    if (!m) return null;

    const candidatos = await candidatosDesdeLaBase(ctx);
    const puntuados = scoreAll(candidatos, perfil);
    const variantes = puntuados
      .filter((s) => s.modelKey === modelKey)
      .sort((a, b) => b.quality - a.quality);

    return {
      modelKey: m.modelKey,
      slug: m.slug,
      name: m.name,
      creator: m.creator,
      description: m.description,
      releaseDate: m.releaseDate,
      knowledgeCutoff: m.knowledgeCutoff,
      openWeights: m.openWeights,
      contextLimit: m.contextLimit,
      outputLimit: m.outputLimit,
      pricing: m.pricing,
      providers: m.providers ?? [],
      programmingRank: m.programmingRank,
      variantes: variantes.map(aTarjeta),
    };
  },
});

/**
 * Metodología y créditos. Sale del mismo sitio del que sale el cálculo, así
 * que la página de metodología no puede quedarse desfasada respecto al código.
 */
export const metodologia = query({
  args: {},
  handler: async () => ({
    metricas: (() => {
      const pesos = pesosDelPerfil("general");
      return Object.entries(METRIC_CONFIG)
        .filter(([, c]) => c.activa)
        .map(([metric, c]) => ({
          metric,
          etiqueta: c.label,
          peso: pesos[metric as keyof typeof pesos],
          vidaMediaMeses: c.halfLifeMonths,
        }));
    })(),
    perfiles: Object.entries(PERFILES).map(([id, p]) => ({
      id,
      etiqueta: p.label,
      mide: (p.mide ?? METRICAS_ACTIVAS()).map((m) => METRIC_CONFIG[m].label),
    })),
    umbrales: {
      benchmarksMinimos: THRESHOLDS.benchmarksMinimos,
      pisoCalidadBarato: THRESHOLDS.pisoCalidadBarato,
      pisoCalidadDiaADia: THRESHOLDS.pisoCalidadDiaADia,
      percentilCostoBarato: THRESHOLDS.percentilCostoBarato,
    },
    mezclaDeTokens: TOKEN_MIX,
    fuentes: SOURCES.map((s) => ({
      id: s.id,
      nombre: s.name,
      tipo: s.kind,
      homepage: s.homepage,
      atribucion: s.attribution,
      licencia: s.license,
      activa: s.enabled,
      nota: s.note,
    })),
  }),
});
