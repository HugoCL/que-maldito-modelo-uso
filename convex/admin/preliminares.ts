import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { effortValidator, metricValidator } from "../schema";
import { buildIndex, resolveModel } from "../matching/resolve";
import { slugify } from "../matching/normalize";
import { LARGO_MINIMO_DEL_TOKEN, tokenValido } from "../ingest/reglasDelRefresco";
import { candidatosParaConsulta } from "../scoring/recompute";
import { estadoDelPreliminar } from "../scoring/preliminares";
import { validarPreliminar } from "../scoring/reglasDePreliminares";

/**
 * Lo que usa /admin/preliminares para cargar a mano los resultados que publica
 * un laboratorio al lanzar un modelo.
 *
 * Son públicas porque las llama la web, y por eso las guarda el mismo secreto
 * que `/api/refrescar`: `REFRESCO_TOKEN`, en las variables de entorno de
 * Convex. Se comprueba aquí y no en la web por lo mismo que allí: cualquiera
 * con la URL del despliegue puede llamar a estas funciones sin pasar por Next.
 */

type Denegada = { estado: "apagada" } | { estado: "denegada" };

function comprobar(token: string): Denegada | null {
  const esperado = process.env.REFRESCO_TOKEN;
  if (!esperado || esperado.length < LARGO_MINIMO_DEL_TOKEN) return { estado: "apagada" };
  if (!tokenValido(token, esperado)) return { estado: "denegada" };
  return null;
}

/**
 * El `modelKey` del catálogo para lo que se escribió en el formulario.
 *
 * Pasa por el mismo resolvedor que los benchmarks, así que «Claude Opus 5.5» y
 * `claude-opus-5-5` acaban en el mismo modelo. Si no resuelve se guarda tal
 * cual, en forma de slug: el caso típico es el día del lanzamiento, con el
 * catálogo todavía sin el modelo, y el preliminar empieza a contar en cuanto
 * lo tenga.
 */
async function resolverModelo(ctx: QueryCtx, escrito: string): Promise<string> {
  const modelos = await ctx.db.query("models").collect();
  const r = resolveModel(escrito, buildIndex(modelos.map((m) => ({ modelKey: m.modelKey, name: m.name }))));
  return r.ok ? r.modelKey : slugify(escrito);
}

/** Rehace el cache de candidatos para que la web vea el cambio sin esperar al cron. */
async function recalcularEnSeguida(ctx: MutationCtx) {
  await ctx.scheduler.runAfter(0, internal.scoring.recompute.recalcular, {});
}

export const listar = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const denegada = comprobar(token);
    if (denegada) return denegada;

    const modelos = await ctx.db.query("models").collect();
    const enElCatalogo = new Map(modelos.map((m) => [m.modelKey, m]));
    const { candidatos } = await candidatosParaConsulta(ctx);
    const filas = await ctx.db.query("preliminares").collect();

    return {
      estado: "ok" as const,
      preliminares: filas
        .map((f) => ({
          id: f._id,
          modelKey: f.modelKey,
          modelName: enElCatalogo.get(f.modelKey)?.name,
          effort: f.effort,
          metric: f.metric,
          value: f.value,
          fuenteUrl: f.fuenteUrl,
          measuredAt: f.measuredAt,
          actualizadoEn: f.actualizadoEn,
          situacion: estadoDelPreliminar(f, candidatos, (k) => enElCatalogo.has(k)),
        }))
        .sort(
          (a, b) =>
            a.modelKey.localeCompare(b.modelKey) ||
            a.effort.localeCompare(b.effort) ||
            a.metric.localeCompare(b.metric),
        ),
      // Para el autocompletado del formulario: lo más nuevo primero, que es lo
      // que se viene a cargar aquí.
      modelos: modelos
        .map((m) => ({ modelKey: m.modelKey, name: m.name, releaseDate: m.releaseDate }))
        .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")),
    };
  },
});

export const guardar = mutation({
  args: {
    token: v.string(),
    modelo: v.string(),
    effort: effortValidator,
    fuenteUrl: v.optional(v.string()),
    measuredAt: v.optional(v.string()),
    valores: v.array(v.object({ metric: metricValidator, value: v.number() })),
  },
  handler: async (ctx, { token, modelo, effort, fuenteUrl, measuredAt, valores }) => {
    const denegada = comprobar(token);
    if (denegada) return denegada;

    const error = validarPreliminar({ modelo, fuenteUrl, measuredAt, valores });
    if (error) return { estado: "invalido" as const, error };

    const modelKey = await resolverModelo(ctx, modelo);
    const ahora = Date.now();

    // Uno por métrica: volver a cargar la misma métrica corrige el número en
    // vez de sumar otro.
    for (const { metric, value } of valores) {
      const previo = await ctx.db
        .query("preliminares")
        .withIndex("by_clave", (q) =>
          q.eq("modelKey", modelKey).eq("effort", effort).eq("metric", metric),
        )
        .unique();
      const fila = { value, fuenteUrl: fuenteUrl || undefined, measuredAt: measuredAt || undefined };
      if (previo) {
        await ctx.db.patch(previo._id, { ...fila, actualizadoEn: ahora });
      } else {
        await ctx.db.insert("preliminares", {
          modelKey,
          effort,
          metric,
          ...fila,
          creadoEn: ahora,
          actualizadoEn: ahora,
        });
      }
    }

    await recalcularEnSeguida(ctx);
    return { estado: "ok" as const, modelKey, guardados: valores.length };
  },
});

export const borrar = mutation({
  args: { token: v.string(), id: v.id("preliminares") },
  handler: async (ctx, { token, id }) => {
    const denegada = comprobar(token);
    if (denegada) return denegada;

    if (await ctx.db.get(id)) {
      await ctx.db.delete(id);
      await recalcularEnSeguida(ctx);
    }
    return { estado: "ok" as const };
  },
});
