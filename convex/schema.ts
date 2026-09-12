import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Niveles de reasoning effort. "default" = el modelo no expone el control, o la
 * fuente no lo especificó. El orden importa: se usa para ordenar variantes.
 */
export const EFFORTS = [
  "default",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export const effortValidator = v.union(
  ...EFFORTS.map((e) => v.literal(e)),
);

/** Métricas de calidad que sabemos leer. Ver convex/scoring/config.ts. */
export const METRICS = [
  "cursorbench.score",
  "deepswe.pass_at_1",
  "terminalbench.accuracy",
  "swerebench.resolved_rate",
  "swebench_verified.resolved",
  "aa.coding_index",
] as const;

export const metricValidator = v.union(
  ...METRICS.map((m) => v.literal(m)),
);

export const tierValidator = v.union(
  v.literal("barato"),
  v.literal("dia_a_dia"),
  v.literal("bueno"),
);

export default defineSchema({
  /** Estado de cada fuente. La definición vive en sources/registry.ts. */
  sources: defineTable({
    sourceId: v.string(),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    lastOkAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastContentHash: v.optional(v.string()),
    consecutiveFailures: v.number(),
  }).index("by_sourceId", ["sourceId"]),

  /**
   * Copia cruda de lo que devolvió cada fuente. Solo se guarda cuando cambia el
   * hash, así que la tabla crece con los cambios reales y no con los días.
   * Permite re-parsear y recalcular la metodología sin volver a descargar nada.
   */
  rawSnapshots: defineTable({
    sourceId: v.string(),
    contentHash: v.string(),
    body: v.string(),
    byteLength: v.number(),
    fetchedAt: v.number(),
  })
    .index("by_sourceId_fetchedAt", ["sourceId", "fetchedAt"])
    .index("by_sourceId_hash", ["sourceId", "contentHash"]),

  /** Bitácora de cada corrida del pipeline. Alimenta /estado. */
  ingestRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    trigger: v.union(v.literal("cron"), v.literal("manual")),
    results: v.array(
      v.object({
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
      }),
    ),
  }).index("by_startedAt", ["startedAt"]),

  /** Catálogo canónico. Poblado por models.dev, enriquecido por OpenRouter. */
  models: defineTable({
    /** Clave canónica: `<creador>/<modelo>`, ej. "anthropic/claude-fable-5-1". */
    slug: v.string(),
    /** Slug corto normalizado, ej. "claude-fable-5-1". Base del matching. */
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
    /** USD por millón de tokens. */
    pricing: v.optional(
      v.object({
        input: v.optional(v.number()),
        output: v.optional(v.number()),
        cacheRead: v.optional(v.number()),
        cacheWrite: v.optional(v.number()),
      }),
    ),
    /** Efforts que el modelo realmente acepta, según models.dev/OpenRouter. */
    supportedEfforts: v.optional(v.array(v.string())),
    /** Proveedores donde está disponible (ids de OpenRouter u otros). */
    providers: v.optional(v.array(v.string())),
    /** Puesto en el top de uso de programación de OpenRouter, si aparece. */
    programmingRank: v.optional(v.number()),
    toolCall: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_modelKey", ["modelKey"])
    .index("by_creatorSlug", ["creatorSlug"]),

  /** La unidad recomendable: modelo x reasoning effort. */
  variants: defineTable({
    modelId: v.id("models"),
    effort: effortValidator,
    /** `<modelKey>@<effort>`, única. */
    variantKey: v.string(),
    updatedAt: v.number(),
  })
    .index("by_variantKey", ["variantKey"])
    .index("by_modelId", ["modelId"]),

  /**
   * Formato largo: un hecho medido por una fuente. Todo lo demás se deriva de
   * aquí, así que cambiar la metodología nunca requiere volver a descargar.
   */
  observations: defineTable({
    sourceId: v.string(),
    snapshotId: v.optional(v.id("rawSnapshots")),
    variantId: v.id("variants"),
    metric: metricValidator,
    /** Siempre 0..1 para métricas de acierto. */
    value: v.number(),
    /** Intervalo de confianza en la misma escala, cuando la fuente lo publica. */
    ciLo: v.optional(v.number()),
    ciHi: v.optional(v.number()),
    nRuns: v.optional(v.number()),
    /** USD por tarea, medido. Solo DeepSWE, CursorBench y SWE-bench lo dan. */
    costPerTask: v.optional(v.number()),
    /** Señales de eficiencia que alguna fuente publica. */
    agentSteps: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    cacheReadTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    /** La cadena tal cual la escribió la fuente, para depurar el matching. */
    sourceKey: v.string(),
    /** Fecha del dato según la fuente (no la de nuestro fetch), si la da. */
    measuredAt: v.optional(v.string()),
    capturedAt: v.number(),
  })
    .index("by_variant_metric", ["variantId", "metric"])
    .index("by_metric", ["metric"])
    .index("by_sourceId_capturedAt", ["sourceId", "capturedAt"]),

  /**
   * Lo que una fuente nombró y no supimos resolver. Nunca se adivina en
   * silencio: cae aquí con su mejor sugerencia y se revisa en el dashboard.
   */
  unresolvedKeys: defineTable({
    sourceId: v.string(),
    sourceKey: v.string(),
    suggestion: v.optional(v.string()),
    suggestionScore: v.optional(v.number()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    timesSeen: v.number(),
  }).index("by_source_key", ["sourceId", "sourceKey"]),

  /** Resultado del scoring por variante, recalculado en cada corrida. */
  scores: defineTable({
    variantId: v.id("variants"),
    quality: v.number(),
    qualityLo: v.number(),
    qualityHi: v.number(),
    /** Suma de pesos de las métricas que sí tenía. 1.0 = cobertura total. */
    coverage: v.number(),
    confidence: v.union(v.literal("alta"), v.literal("media"), v.literal("baja")),
    /** USD por tarea. Medido si costMeasured, estimado si no. */
    cost: v.optional(v.number()),
    costMeasured: v.boolean(),
    costLo: v.optional(v.number()),
    costHi: v.optional(v.number()),
    /** USD por millón de tokens con la mezcla agéntica. */
    blendedPrice: v.optional(v.number()),
    metrics: v.array(
      v.object({
        metric: metricValidator,
        value: v.number(),
        normalized: v.number(),
        weight: v.number(),
      }),
    ),
    onFrontier: v.boolean(),
    computedAt: v.number(),
  })
    .index("by_variantId", ["variantId"])
    .index("by_computedAt", ["computedAt"]),

  /** Las tres respuestas, sin filtros. Los filtros se recalculan en vivo. */
  rankings: defineTable({
    tier: tierValidator,
    variantId: v.id("variants"),
    runnerUpVariantId: v.optional(v.id("variants")),
    quality: v.number(),
    cost: v.optional(v.number()),
    costMeasured: v.boolean(),
    rationale: v.string(),
    computedAt: v.number(),
  })
    .index("by_tier_computedAt", ["tier", "computedAt"])
    .index("by_computedAt", ["computedAt"]),
});
