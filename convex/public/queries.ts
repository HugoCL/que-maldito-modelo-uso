import { v } from "convex/values";
import { query } from "../_generated/server";
import { candidatosParaConsulta } from "../scoring/recompute";
import { construirEscala, escalaPublica, scoreAll } from "../scoring/compute";
import { elegibles, paretoFrontier, seleccionarRespuestas } from "../scoring/tiers";
import { aTarjeta } from "../scoring/presentar";
import {
  METRIC_CONFIG,
  THRESHOLDS,
  TOKEN_MIX,
  fuenteDeMetrica,
  metricasExcluidas,
  minimoDeBenchmarks,
  pesosIguales,
} from "../scoring/config";
import { aplicarFiltrosDeCatalogo } from "../scoring/filtros";
import { SOURCES } from "../sources/registry";

/**
 * Fuentes que el visitante ha apagado, por su identificador (`cursorbench`).
 * Solo se pueden apagar las que declaran un sesgo de cobertura en la config;
 * cualquier otra cosa que llegue aquí se ignora sola.
 */
const sinFuentes = v.optional(v.array(v.string()));

const filtros = {
  sin: sinFuentes,
  /**
   * Cuántos benchmarks distintos hay que exigir para poder ser respuesta. Sin
   * él manda el umbral de la metodología; la web solo deja bajarlo a uno, que
   * es "todo lo que alguien ha medido".
   */
  minimo: v.optional(v.number()),
  /** Solo modelos disponibles en alguno de estos proveedores. */
  proveedores: v.optional(v.array(v.string())),
  soloOpenWeights: v.optional(v.boolean()),
  /** Techo de USD por tarea. */
  presupuestoMax: v.optional(v.number()),
  /** Atajo de familia (`gpt`, `claude`, `gemini`, `grok`). */
  familia: v.optional(v.string()),
  /** Modelos que el visitante saca de la evaluación, por `modelKey`. */
  ocultos: v.optional(v.array(v.string())),
};

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
    const candidatos = await candidatosParaConsulta(ctx);
    const puntuados = scoreAll(candidatos, Date.now(), metricasExcluidas(args.sin));
    const filtrados = aplicarFiltrosDeCatalogo(puntuados, args);
    const minimo = minimoDeBenchmarks(args.minimo);

    const { tarjetas, sinDiaADia } = seleccionarRespuestas(filtrados, minimo);
    const pool = elegibles(filtrados, minimo);
    const enFrontera = new Set(paretoFrontier(pool));

    // Medidas por menos benchmarks de los que se exigen: no pueden ser
    // respuesta, pero existen y son casi todo lo que hay de open weight. El
    // número se enseña en la portada para que la ausencia se lea como una
    // decisión y no como un agujero de datos. Con el mínimo en uno no queda
    // ninguna fuera y la línea desaparece sola.
    const unaFuente = filtrados.filter((s) => s.benchmarks > 0 && s.benchmarks < minimo);

    const ultima = await ctx.db
      .query("ingestRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .first();

    return {
      actualizado: ultima?.finishedAt ?? ultima?.startedAt ?? null,
      totales: {
        candidatos: candidatos.length,
        elegibles: pool.length,
        enFrontera: enFrontera.size,
        unaFuente: unaFuente.length,
      },
      tarjetas: tarjetas.map((t) => ({
        tier: t.tier,
        razon: t.razon,
        razonCorta: t.razonCorta,
        ganador: aTarjeta(t.ganador),
        alternativas: t.alternativas.map(aTarjeta),
        repiteA: t.repiteA,
      })),
      sinDiaADia,
      // El conjunto elegible entero, no solo la frontera. El gráfico dibuja
      // los dos: la frontera es una línea que se entiende mucho mejor cuando
      // se ve contra lo que dejó atrás.
      elegibles: pool
        .sort((a, b) => b.quality - a.quality)
        .map((s) => ({ ...aTarjeta(s), enFrontera: enFrontera.has(s) })),
    };
  },
});

/** Todo lo puntuado, para el comparador. Incluye lo de confianza baja. */
export const listaVariantes = query({
  args: { sin: sinFuentes },
  handler: async (ctx, args) => {
    const candidatos = await candidatosParaConsulta(ctx);
    const puntuados = scoreAll(candidatos, Date.now(), metricasExcluidas(args.sin));
    const enFrontera = new Set(paretoFrontier(elegibles(puntuados)));
    return puntuados
      .sort((a, b) => b.quality - a.quality)
      .map((s) => ({ ...aTarjeta(s), enFrontera: enFrontera.has(s) }));
  },
});

/** Ficha de un modelo: todas sus variantes y el desglose por benchmark. */
export const modelo = query({
  args: { modelKey: v.string(), sin: sinFuentes },
  handler: async (ctx, { modelKey, sin }) => {
    const m = await ctx.db
      .query("models")
      .withIndex("by_modelKey", (q) => q.eq("modelKey", modelKey))
      .unique();
    if (!m) return null;

    const candidatos = await candidatosParaConsulta(ctx);
    const puntuados = scoreAll(candidatos, Date.now(), metricasExcluidas(sin));
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
 * Los desniveles y el encogimiento de hoy, para /metodologia.
 *
 * Va aparte de `metodologia` a propósito: eso es configuración y se sirve sin
 * tocar la base, y esto hay que calcularlo sobre el conjunto entero. Juntarlos
 * le cobraría esa lectura a la página principal, que solo necesita la parte de
 * configuración.
 */
export const escala = query({
  args: { sin: v.optional(v.array(v.string())) },
  handler: async (ctx, { sin }) =>
    escalaPublica(
      construirEscala(await candidatosParaConsulta(ctx), Date.now(), metricasExcluidas(sin)),
    ),
});

/**
 * Metodología y créditos. Sale del mismo sitio del que sale el cálculo, así
 * que la página de metodología no puede quedarse desfasada respecto al código.
 */
export const metodologia = query({
  args: {},
  handler: async () => ({
    metricas: (() => {
      const pesos = pesosIguales();
      return Object.entries(METRIC_CONFIG)
        .filter(([, c]) => c.activa)
        .map(([metric, c]) => ({
          metric,
          // El identificador con el que se apaga desde la URL. Va aquí para
          // que la barra de filtros no tenga que partir claves a mano.
          fuente: fuenteDeMetrica(metric as keyof typeof METRIC_CONFIG),
          etiqueta: c.label,
          peso: pesos[metric as keyof typeof pesos],
          vidaMediaMeses: c.halfLifeMonths,
          sesgo: c.sesgo,
        }));
    })(),
    umbrales: {
      benchmarksMinimos: THRESHOLDS.benchmarksMinimos,
      benchmarksMinimosSuelo: THRESHOLDS.benchmarksMinimosSuelo,
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
