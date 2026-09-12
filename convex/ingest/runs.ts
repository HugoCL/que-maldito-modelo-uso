import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";

/** Bitácora de corridas. Es lo que alimenta la página /estado. */

const resultado = v.object({
  sourceId: v.string(),
  status: v.union(
    v.literal("ok"),
    v.literal("sin_cambios"),
    v.literal("error"),
    v.literal("omitida"),
  ),
  observations: v.optional(v.number()),
  unresolved: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  error: v.optional(v.string()),
});

export const iniciar = internalMutation({
  args: { trigger: v.union(v.literal("cron"), v.literal("manual")) },
  handler: async (ctx, { trigger }) =>
    await ctx.db.insert("ingestRuns", {
      startedAt: Date.now(),
      trigger,
      results: [],
    }),
});

export const terminar = internalMutation({
  args: { runId: v.id("ingestRuns"), results: v.array(resultado) },
  handler: async (ctx, { runId, results }) => {
    await ctx.db.patch(runId, { finishedAt: Date.now(), results });

    // Con conservar un par de meses de bitácora basta.
    const viejas = await ctx.db
      .query("ingestRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .collect();
    for (const r of viejas.slice(60)) await ctx.db.delete(r._id);
  },
});

/** Última corrida más el estado de cada fuente. */
export const estado = query({
  args: {},
  handler: async (ctx) => {
    const ultima = await ctx.db
      .query("ingestRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .first();
    const fuentes = await ctx.db.query("sources").collect();
    const sinResolver = await ctx.db.query("unresolvedKeys").collect();

    return {
      ultimaCorrida: ultima,
      fuentes: fuentes.map((f) => ({
        sourceId: f.sourceId,
        enabled: f.enabled,
        lastRunAt: f.lastRunAt,
        lastOkAt: f.lastOkAt,
        lastError: f.lastError,
        consecutiveFailures: f.consecutiveFailures,
      })),
      sinResolver: sinResolver
        .sort((a, b) => b.timesSeen - a.timesSeen)
        .map((u) => ({
          sourceId: u.sourceId,
          sourceKey: u.sourceKey,
          suggestion: u.suggestion,
          suggestionScore: u.suggestionScore,
          timesSeen: u.timesSeen,
        })),
    };
  },
});
