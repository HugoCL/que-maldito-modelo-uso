import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { USER_AGENT } from "../sources/registry";

/**
 * Descarga y hash. Solo se guarda una copia cuando el contenido cambia, así
 * que la tabla crece con los cambios reales y no con los días, y siempre se
 * puede volver a parsear sin molestar a la fuente.
 */

/** SHA-256 en hexadecimal. Disponible en el runtime por defecto de Convex. */
export async function hashOf(body: string): Promise<string> {
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type FetchResult = { body: string; contentHash: string };

/**
 * Un intento de descarga, con tiempo límite. No reintenta: de eso se encarga
 * quien llama, que es el único que sabe si vale la pena.
 */
export async function fetchSource(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<FetchResult> {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al pedir ${url}`);
  }
  const body = await res.text();
  if (!body.trim()) {
    throw new Error(`${url} respondió vacío`);
  }
  return { body, contentHash: await hashOf(body) };
}

export const ultimoHash = internalQuery({
  args: { sourceId: v.string() },
  handler: async (ctx, { sourceId }) => {
    const estado = await ctx.db
      .query("sources")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .unique();
    return estado?.lastContentHash ?? null;
  },
});

export const guardarSnapshot = internalMutation({
  args: {
    sourceId: v.string(),
    contentHash: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { sourceId, contentHash, body }) => {
    const existente = await ctx.db
      .query("rawSnapshots")
      .withIndex("by_sourceId_hash", (q) =>
        q.eq("sourceId", sourceId).eq("contentHash", contentHash),
      )
      .first();
    if (existente) return existente._id;

    return await ctx.db.insert("rawSnapshots", {
      sourceId,
      contentHash,
      body,
      byteLength: body.length,
      fetchedAt: Date.now(),
    });
  },
});

export const marcarFuente = internalMutation({
  args: {
    sourceId: v.string(),
    enabled: v.boolean(),
    ok: v.boolean(),
    contentHash: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { sourceId, enabled, ok, contentHash, error }) => {
    const ahora = Date.now();
    const previo = await ctx.db
      .query("sources")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .unique();

    const campos = {
      sourceId,
      enabled,
      lastRunAt: ahora,
      lastOkAt: ok ? ahora : previo?.lastOkAt,
      lastError: ok ? undefined : error,
      lastContentHash: contentHash ?? previo?.lastContentHash,
      consecutiveFailures: ok ? 0 : (previo?.consecutiveFailures ?? 0) + 1,
    };

    if (previo) await ctx.db.patch(previo._id, campos);
    else await ctx.db.insert("sources", campos);
  },
});

/**
 * Limpia snapshots viejos. Guardamos los últimos de cada fuente para poder
 * recalcular hacia atrás, pero no una copia de cada día desde siempre.
 */
export const podarSnapshots = internalMutation({
  args: { sourceId: v.string(), conservar: v.optional(v.number()) },
  handler: async (ctx, { sourceId, conservar = 10 }) => {
    const todos = await ctx.db
      .query("rawSnapshots")
      .withIndex("by_sourceId_fetchedAt", (q) => q.eq("sourceId", sourceId))
      .order("desc")
      .collect();
    for (const viejo of todos.slice(conservar)) {
      await ctx.db.delete(viejo._id);
    }
    return todos.length - Math.min(todos.length, conservar);
  },
});
