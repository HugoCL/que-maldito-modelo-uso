import { internalMutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Candidate } from "./compute";
import { scoreAll } from "./compute";
import { elegirTarjetas } from "./tiers";

/** Cuántos candidatos van en cada fila de la tabla `candidatos`. */
const POR_TROZO = 150;

/**
 * Los candidatos que usa una consulta pública, y la hora contra la que se
 * descuenta la antigüedad de sus mediciones.
 *
 * Salen del cache que deja cada run, que es una fila por cada 150. Si no hay
 * cache —base recién sembrada, o un despliegue anterior a esta tabla— se arman
 * en vivo: es más caro, pero una web en blanco esperando a que el cron pase a
 * las 6 UTC sería peor.
 *
 * La hora es la del run y no `Date.now()`, y es por I/O. Convex invalida a
 * menudo el cache de una consulta que lee el reloj, para no servir un
 * resultado viejo, así que cada visita volvía a leer la tabla entera aunque
 * nada hubiera cambiado desde las 6 UTC. Con la hora del run el resultado solo
 * depende de lo que hay en la base y se cachea hasta el run siguiente. El
 * precio es que la antigüedad avanza a saltos de un día, y con vidas medias de
 * meses eso no mueve ninguna nota. Además es la misma hora con la que
 * `recalcular` comprueba el cálculo, así que lo que ve la web es lo que se
 * comprobó.
 */
export async function candidatosParaConsulta(
  ctx: QueryCtx,
): Promise<{ candidatos: Candidate[]; ahora: number }> {
  const partes = await ctx.db.query("candidatos").withIndex("by_parte").collect();
  if (partes.length === 0) {
    return { candidatos: await candidatosDesdeLaBase(ctx), ahora: Date.now() };
  }
  return { candidatos: partes.flatMap((p) => p.trozo), ahora: partes[0].generadoEn };
}

/**
 * Arma los candidatos leyendo la base.
 *
 * Se entra por `observations` y no por `variants` a propósito. Una variante
 * sin mediciones no es candidata, y hay dos fuentes de ellas: modelos que se
 * cayeron de un leaderboard —su variante se queda para siempre, las
 * observaciones no— y modelos del catálogo que nadie midió nunca. Barriendo
 * `models` y `variants` enteras se leían cientos de documentos para descartar
 * casi todos; desde las observaciones se lee exactamente lo que se usa.
 *
 * El orden final es por `variantKey` y no el que traiga la base: los empates de
 * calidad se rompen por posición en el array, así que dejarlo al orden de
 * inserción hacía que la respuesta pudiera cambiar sin que cambiara ningún dato.
 */
export async function candidatosDesdeLaBase(ctx: QueryCtx): Promise<Candidate[]> {
  const observaciones = await ctx.db.query("observations").collect();

  const porVariante = new Map<Id<"variants">, typeof observaciones>();
  for (const o of observaciones) {
    const lista = porVariante.get(o.variantId);
    if (lista) lista.push(o);
    else porVariante.set(o.variantId, [o]);
  }

  // Un mismo modelo tiene varias variantes; se lee una sola vez.
  const modelos = new Map<Id<"models">, Doc<"models"> | null>();
  const modeloDe = async (id: Id<"models">) => {
    if (!modelos.has(id)) modelos.set(id, await ctx.db.get(id));
    return modelos.get(id) ?? null;
  };

  const candidatos: Candidate[] = [];
  for (const [variantId, obs] of porVariante) {
    const variante = await ctx.db.get(variantId);
    if (!variante) continue;
    const modelo = await modeloDe(variante.modelId);
    if (!modelo) continue;

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

  return candidatos.sort((a, b) => a.variantKey.localeCompare(b.variantKey));
}

/** Rehace el cache de candidatos: fuera el de ayer, dentro el de hoy. */
async function guardarCandidatos(ctx: MutationCtx, candidatos: Candidate[], ahora: number) {
  for (const viejo of await ctx.db.query("candidatos").collect()) {
    await ctx.db.delete(viejo._id);
  }
  for (let i = 0; i < candidatos.length; i += POR_TROZO) {
    await ctx.db.insert("candidatos", {
      parte: i / POR_TROZO,
      generadoEn: ahora,
      trozo: candidatos.slice(i, i + POR_TROZO),
    });
  }
}

export const recalcular = internalMutation({
  args: {},
  handler: async (ctx) => {
    const candidatos = await candidatosDesdeLaBase(ctx);
    if (candidatos.length === 0) return { candidatos: 0, tarjetas: 0 };

    const ahora = Date.now();

    // Las entradas del cálculo, para que las consultas públicas no tengan que
    // rearmarlas leyendo tres tablas enteras en cada visita. Ver la tabla
    // `candidatos` en schema.ts.
    await guardarCandidatos(ctx, candidatos, ahora);

    // El resultado del cálculo no se guarda en ningún lado: los filtros de la
    // web vuelven a elegir sobre el subconjunto, así que una tabla de scores y
    // rankings sin filtros no responde ninguna pregunta que alguien haga. Se
    // calcula igual, sobre los candidatos que ya están en memoria y sin leer
    // nada más, porque es el mismo camino que recorre la consulta pública: si
    // hoy se rompe, el run se cae aquí y no en la primera visita.
    const tarjetas = elegirTarjetas(scoreAll(candidatos, ahora));

    return { candidatos: candidatos.length, tarjetas: tarjetas.length };
  },
});
