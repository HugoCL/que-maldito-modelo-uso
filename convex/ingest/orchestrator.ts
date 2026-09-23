import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { SOURCES } from "../sources/registry";
import type { ParsedObservation, Source } from "../sources/types";
import { buildIndex, resolveModel } from "../matching/resolve";
import { fetchSource } from "./snapshot";

/**
 * Una corrida del pipeline: baja cada fuente, la parsea, resuelve identidades
 * y recalcula las tarjetas.
 *
 * El orden no es casual. Primero los catálogos, porque el resolvedor necesita
 * saber qué modelos existen antes de poder colgar mediciones de ellos.
 *
 * Cada fuente se aísla: si CursorBench cambia de HTML un martes, el resto del
 * pipeline sigue corriendo y /estado lo dice.
 */

type Resultado = {
  sourceId: string;
  status: "ok" | "sin_cambios" | "error" | "omitida";
  observations?: number;
  unresolved?: number;
  durationMs?: number;
  error?: string;
};

/** Cabeceras propias de una fuente. Solo AA necesita credencial. */
function headersDe(source: Source): Record<string, string> {
  if (source.id === "artificial-analysis") {
    const key = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
    return key ? { "x-api-key": key } : {};
  }
  return {};
}

export const runAll = internalAction({
  args: {
    trigger: v.optional(v.union(v.literal("cron"), v.literal("manual"))),
    /** Para depurar una sola fuente sin tocar el resto. */
    soloFuente: v.optional(v.string()),
    /** Rehace el parseo aunque el contenido no haya cambiado. */
    forzar: v.optional(v.boolean()),
    /**
     * La fila de la bitácora, cuando ya la abrió quien encargó el run. Así lo
     * hace `ingest/refresco:pedir`, para que dos peticiones seguidas no puedan
     * colar dos runs a la vez.
     */
    runId: v.optional(v.id("ingestRuns")),
  },
  handler: async (ctx, { trigger = "manual", soloFuente, forzar = false, runId: abierta }) => {
    const runId = abierta ?? (await ctx.runMutation(internal.ingest.runs.iniciar, { trigger }));
    const resultados: Resultado[] = [];

    // Los catálogos primero: sin ellos no hay contra qué resolver nombres.
    const enOrden = [...SOURCES].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === "catalogo" ? -1 : 1,
    );

    // El índice de nombres se arma una vez y lo comparten todos los
    // benchmarks: es el catálogo entero, y leerlo una vez por leaderboard era
    // pagar cuatro veces por la misma tabla. Se construye tarde, al llegar al
    // primer benchmark, porque para entonces los catálogos ya han escrito los
    // modelos nuevos de hoy; ninguna fuente de benchmarks crea modelos.
    let index: ReturnType<typeof buildIndex> | undefined;

    for (const source of enOrden) {
      if (soloFuente && source.id !== soloFuente) continue;

      if (!source.enabled) {
        resultados.push({ sourceId: source.id, status: "omitida" });
        await ctx.runMutation(internal.ingest.snapshot.marcarFuente, {
          sourceId: source.id,
          enabled: false,
          ok: true,
        });
        continue;
      }

      const t0 = Date.now();
      try {
        const { body, contentHash } = await fetchSource(source.url, headersDe(source));

        const previo = await ctx.runQuery(internal.ingest.snapshot.ultimoHash, {
          sourceId: source.id,
        });
        if (previo === contentHash && !forzar) {
          resultados.push({
            sourceId: source.id,
            status: "sin_cambios",
            durationMs: Date.now() - t0,
          });
          await ctx.runMutation(internal.ingest.snapshot.marcarFuente, {
            sourceId: source.id,
            enabled: true,
            ok: true,
            contentHash,
          });
          continue;
        }

        // Guardar la copia cruda antes de parsear: si el parser se rompe con
        // una maquetación nueva, el cuerpo queda para verlo sin volver a pedirlo.
        const crudo = new Blob([body]);
        const snapshotId = await ctx.runMutation(internal.ingest.snapshot.guardarSnapshot, {
          sourceId: source.id,
          contentHash,
          storageId: await ctx.storage.store(crudo),
          byteLength: crudo.size,
        });

        let escritas = 0;
        let sinResolver = 0;

        if (source.kind === "catalogo") {
          const entries = source.parse(body);
          if (entries.length === 0) throw new Error("el parser no devolvió nada");
          const { creados, actualizados } = await ctx.runMutation(
            internal.ingest.store.upsertCatalogo,
            { entries, primaria: source.id === "modelsdev" },
          );
          escritas = creados + actualizados;
        } else {
          const crudas = source.parse(body);
          if (crudas.length === 0) throw new Error("el parser no devolvió nada");

          index ??= buildIndex(
            await ctx.runQuery(internal.ingest.store.catalogoParaMatching, {}),
          );

          // modelHint se queda fuera: a partir de aquí manda el modelKey resuelto.
          type Resuelta = Omit<ParsedObservation, "modelHint"> & { modelKey: string };
          const resueltas: Resuelta[] = [];
          const perdidas = new Map<string, { sourceKey: string; suggestion?: string; score?: number }>();

          for (const o of crudas) {
            const r = resolveModel(o.modelHint, index);
            if (r.ok) {
              const { modelHint, ...resto } = o;
              void modelHint;
              resueltas.push({ ...resto, modelKey: r.modelKey });
            } else {
              perdidas.set(o.sourceKey, {
                sourceKey: o.sourceKey,
                suggestion: r.suggestion,
                score: r.score,
              });
            }
          }

          escritas = await ctx.runMutation(internal.ingest.store.reemplazarObservaciones, {
            sourceId: source.id,
            snapshotId,
            observaciones: resueltas,
          });
          sinResolver = perdidas.size;
          await ctx.runMutation(internal.ingest.store.registrarSinResolver, {
            sourceId: source.id,
            claves: [...perdidas.values()],
          });
        }

        await ctx.runMutation(internal.ingest.snapshot.marcarFuente, {
          sourceId: source.id,
          enabled: true,
          ok: true,
          contentHash,
        });
        await ctx.runMutation(internal.ingest.snapshot.podarSnapshots, { sourceId: source.id });

        resultados.push({
          sourceId: source.id,
          status: "ok",
          observations: escritas,
          unresolved: sinResolver,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        // Una fuente caída no puede llevarse el resto por delante: los datos
        // de ayer siguen sirviendo, y /estado dirá desde cuándo.
        resultados.push({
          sourceId: source.id,
          status: "error",
          durationMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        });
        await ctx.runMutation(internal.ingest.snapshot.marcarFuente, {
          sourceId: source.id,
          enabled: true,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await ctx.runMutation(internal.scoring.recompute.recalcular, {});
    await ctx.runMutation(internal.ingest.runs.terminar, { runId, results: resultados });

    return resultados;
  },
});
