import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { effortValidator, metricValidator } from "../schema";
import type { Doc, Id } from "../_generated/dataModel";
import { soloLoQueCambia } from "./comparar";

/**
 * Escritura del catálogo y de las observaciones.
 *
 * Todo pasa por aquí para que el orquestador, que es una acción y no puede
 * tocar la base, se limite a descargar y parsear.
 */

const catalogEntry = v.object({
  modelKey: v.string(),
  name: v.string(),
  creator: v.string(),
  creatorSlug: v.string(),
  family: v.optional(v.string()),
  description: v.optional(v.string()),
  releaseDate: v.optional(v.string()),
  knowledgeCutoff: v.optional(v.string()),
  openWeights: v.optional(v.boolean()),
  contextLimit: v.optional(v.number()),
  outputLimit: v.optional(v.number()),
  pricing: v.optional(
    v.object({
      input: v.optional(v.number()),
      output: v.optional(v.number()),
      cacheRead: v.optional(v.number()),
      cacheWrite: v.optional(v.number()),
    }),
  ),
  supportedEfforts: v.optional(v.array(v.string())),
  providers: v.optional(v.array(v.string())),
  programmingRank: v.optional(v.number()),
  toolCall: v.optional(v.boolean()),
});

/** Solo pisa un campo si el nuevo valor existe: las fuentes se complementan. */
function fusionar<T extends object>(previo: T, nuevo: Partial<T>): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(nuevo)) {
    if (val === undefined) continue;
    out[k] = val;
  }
  return out as Partial<T>;
}

export const upsertCatalogo = internalMutation({
  args: { entries: v.array(catalogEntry), primaria: v.boolean() },
  handler: async (ctx, { entries, primaria }) => {
    let creados = 0;
    let actualizados = 0;
    let intactos = 0;

    for (const e of entries) {
      const previo = await ctx.db
        .query("models")
        .withIndex("by_modelKey", (q) => q.eq("modelKey", e.modelKey))
        .unique();

      if (!previo) {
        // Una fuente secundaria (OpenRouter) no inventa modelos que el
        // catálogo de primera mano no conoce: traería ruido de gateways.
        if (!primaria) continue;
        await ctx.db.insert("models", {
          ...e,
          slug: `${e.creatorSlug}/${e.modelKey}`,
          updatedAt: Date.now(),
        });
        creados++;
        continue;
      }

      const cambios = primaria
        ? { ...e, slug: `${e.creatorSlug}/${e.modelKey}` }
        : // Una fuente secundaria solo rellena huecos y suma proveedores.
          fusionar(previo, {
            programmingRank: e.programmingRank,
            contextLimit: previo.contextLimit ?? e.contextLimit,
            outputLimit: previo.outputLimit ?? e.outputLimit,
            providers: [...new Set([...(previo.providers ?? []), ...(e.providers ?? [])])].sort(),
          });

      const nuevos = soloLoQueCambia(previo, cambios);
      // Sin cambios no se toca la fila, y eso incluye `updatedAt`: el campo
      // pasa a decir cuándo cambió el modelo, que es lo que su nombre promete.
      if (Object.keys(nuevos).length === 0) {
        intactos++;
        continue;
      }

      await ctx.db.patch(previo._id, { ...nuevos, updatedAt: Date.now() });
      actualizados++;
    }

    // `actualizados` cuenta filas que de verdad cambiaron, así que en /estado
    // el número de un catálogo es «qué se movió hoy» y no «cuántos modelos hay».
    return { creados, actualizados, intactos };
  },
});

/** Devuelve el id de la variante, creándola si hace falta. */
async function variantePara(
  ctx: MutationCtx,
  modelId: Id<"models">,
  modelKey: string,
  effort: Doc<"variants">["effort"],
): Promise<Id<"variants">> {
  const variantKey = `${modelKey}@${effort}`;
  const previo = await ctx.db
    .query("variants")
    .withIndex("by_variantKey", (q) => q.eq("variantKey", variantKey))
    .unique();
  if (previo) return previo._id;

  return await ctx.db.insert("variants", {
    modelId,
    effort,
    variantKey,
    updatedAt: Date.now(),
  });
}

const observacion = v.object({
  sourceKey: v.string(),
  modelKey: v.string(),
  effort: effortValidator,
  metric: metricValidator,
  value: v.number(),
  ciLo: v.optional(v.number()),
  ciHi: v.optional(v.number()),
  nRuns: v.optional(v.number()),
  costPerTask: v.optional(v.number()),
  agentSteps: v.optional(v.number()),
  durationSeconds: v.optional(v.number()),
  inputTokens: v.optional(v.number()),
  cacheReadTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  measuredAt: v.optional(v.string()),
});

export const reemplazarObservaciones = internalMutation({
  args: {
    sourceId: v.string(),
    snapshotId: v.optional(v.id("rawSnapshots")),
    observaciones: v.array(observacion),
  },
  handler: async (ctx, { sourceId, snapshotId, observaciones }) => {
    // Una fuente publica su tabla entera cada vez, así que su aporte se
    // reemplaza completo: si un modelo desaparece del leaderboard, también
    // tiene que desaparecer de aquí.
    const viejas = await ctx.db
      .query("observations")
      .withIndex("by_sourceId_capturedAt", (q) => q.eq("sourceId", sourceId))
      .collect();
    for (const o of viejas) await ctx.db.delete(o._id);

    const ahora = Date.now();
    let escritas = 0;

    for (const o of observaciones) {
      const model = await ctx.db
        .query("models")
        .withIndex("by_modelKey", (q) => q.eq("modelKey", o.modelKey))
        .unique();
      if (!model) continue;

      const variantId = await variantePara(ctx, model._id, o.modelKey, o.effort);
      // modelKey y effort ya cumplieron: de aquí en adelante la observación
      // cuelga de la variante, que es justo "ese modelo a ese effort". Guardar
      // el effort otra vez en la fila sería una segunda copia que puede mentir.
      const { modelKey, effort, ...resto } = o;
      void modelKey;
      void effort;
      await ctx.db.insert("observations", {
        ...resto,
        sourceId,
        snapshotId,
        variantId,
        capturedAt: ahora,
      });
      escritas++;
    }
    return escritas;
  },
});

export const registrarSinResolver = internalMutation({
  args: {
    sourceId: v.string(),
    claves: v.array(
      v.object({
        sourceKey: v.string(),
        suggestion: v.optional(v.string()),
        score: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { sourceId, claves }) => {
    const ahora = Date.now();
    // El conjunto de este parseo sustituye al anterior: si un nombre ahora
    // sí empató, no puede seguir en /estado como si no puntuara.
    const previos = await ctx.db
      .query("unresolvedKeys")
      .withIndex("by_source_key", (q) => q.eq("sourceId", sourceId))
      .collect();
    const porClave = new Map(previos.map((p) => [p.sourceKey, p]));
    const vigentes = new Set(claves.map((c) => c.sourceKey));

    for (const p of previos) {
      if (!vigentes.has(p.sourceKey)) await ctx.db.delete(p._id);
    }

    for (const c of claves) {
      const previo = porClave.get(c.sourceKey);
      if (previo) {
        await ctx.db.patch(previo._id, {
          lastSeenAt: ahora,
          timesSeen: previo.timesSeen + 1,
          suggestion: c.suggestion,
          suggestionScore: c.score,
        });
      } else {
        await ctx.db.insert("unresolvedKeys", {
          sourceId,
          sourceKey: c.sourceKey,
          suggestion: c.suggestion,
          suggestionScore: c.score,
          firstSeenAt: ahora,
          lastSeenAt: ahora,
          timesSeen: 1,
        });
      }
    }
    return claves.length;
  },
});

/** Catálogo completo, en la forma que espera el resolvedor. */
export const catalogoParaMatching = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("models").collect()).map((m) => ({
      modelKey: m.modelKey,
      name: m.name,
    })),
});
