import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { LARGO_MINIMO_DEL_TOKEN, runEnCurso, tokenValido } from "./reglasDelRefresco";

/**
 * Lanzar un run del pipeline sin esperar al cron de las 06:00 UTC.
 *
 * Es pública porque la llama la ruta `/api/refrescar` de la web, y por eso la
 * guarda un secreto: `REFRESCO_TOKEN`, en las variables de entorno de Convex.
 * Se comprueba aquí y no en la web porque cualquiera con la URL del despliegue
 * puede llamar a esta función directamente, sin pasar por Next. Sin la
 * variable, o con una demasiado corta, la función existe pero no hace nada.
 *
 * No espera al run: lo encarga y vuelve. Bajar todas las fuentes tarda más de
 * lo que una función de Vercel aguanta abierta, y /estado ya enseña cómo va.
 */
export const pedir = mutation({
  args: {
    token: v.string(),
    /** Rehace el parseo aunque ninguna fuente haya cambiado. */
    forzar: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, forzar }) => {
    const esperado = process.env.REFRESCO_TOKEN;
    if (!esperado || esperado.length < LARGO_MINIMO_DEL_TOKEN) return { estado: "apagada" as const };
    if (!tokenValido(token, esperado)) return { estado: "denegada" as const };

    const ultima = await ctx.db
      .query("ingestRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .first();
    if (runEnCurso(ultima, Date.now())) {
      return { estado: "en_curso" as const, desde: ultima!.startedAt };
    }

    // La fila se abre aquí y no dentro del run: una mutación no se solapa con
    // otra, así que una segunda petición ya la ve y no encarga otro.
    const runId = await ctx.db.insert("ingestRuns", {
      startedAt: Date.now(),
      trigger: "manual",
      results: [],
    });
    await ctx.scheduler.runAfter(0, internal.ingest.orchestrator.runAll, {
      trigger: "manual",
      forzar,
      runId,
    });
    return { estado: "encargada" as const };
  },
});
