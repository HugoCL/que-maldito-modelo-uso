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
  "aa.coding_index",
] as const;

export const metricValidator = v.union(
  ...METRICS.map((m) => v.literal(m)),
);

/** USD por millón de tokens. Lo comparten el catálogo y el cache de candidatos. */
export const pricingValidator = v.object({
  input: v.optional(v.number()),
  output: v.optional(v.number()),
  cacheRead: v.optional(v.number()),
  cacheWrite: v.optional(v.number()),
});

/**
 * Un candidato: una variante con todo lo que el cálculo necesita de ella y
 * nada más. Es la proyección de `models` + `variants` + `observations` que
 * consume `scoreAll`, y lo que se guarda en la tabla `candidatos`.
 */
export const candidatoValidator = v.object({
  variantKey: v.string(),
  modelKey: v.string(),
  modelName: v.string(),
  creator: v.string(),
  effort: effortValidator,
  metrics: v.array(
    v.object({
      metric: metricValidator,
      value: v.number(),
      ciLo: v.optional(v.number()),
      ciHi: v.optional(v.number()),
      measuredAt: v.optional(v.string()),
      /**
       * Lo publicó el laboratorio el día del lanzamiento, no el benchmark.
       * Ver la tabla `preliminares`.
       */
      preliminar: v.optional(v.boolean()),
      /** Dónde lo publicó, cuando es preliminar. */
      fuenteUrl: v.optional(v.string()),
    }),
  ),
  costSamples: v.array(v.object({ sourceId: v.string(), costPerTask: v.number() })),
  pricing: v.optional(pricingValidator),
  providers: v.array(v.string()),
  openWeights: v.optional(v.boolean()),
  programmingRank: v.optional(v.number()),
});

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
    /**
     * La copia cruda dentro del documento. Ya no se escribe: queda para las
     * filas de antes de mover todo a `storageId`, y se va con ellas cuando las
     * pode `podarSnapshots`. Ver convex/ingest/snapshot.ts.
     */
    body: v.optional(v.string()),
    /** Donde vive la copia cruda. */
    storageId: v.optional(v.id("_storage")),
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
    pricing: v.optional(pricingValidator),
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

  /**
   * Resultados que publica el laboratorio al lanzar un modelo, antes de que el
   * benchmark lo mida con su propio harness. Se cargan a mano desde
   * /admin/preliminares.
   *
   * Van aparte de `observations` porque no son lo mismo: una observación la
   * midió la fuente y se reemplaza entera en cada run; esto lo cuenta el
   * fabricante y no lo toca ningún run. Se juntan al armar los candidatos, y
   * ahí el valor oficial sobrescribe al preliminar de la misma métrica: el día
   * que el benchmark publica, el preliminar deja de contar solo, sin borrarlo.
   * Ver scoring/preliminares.ts.
   *
   * Cuelga del `modelKey` y no de una variante a propósito: así se puede
   * cargar el día del lanzamiento aunque el catálogo todavía no tenga el
   * modelo, y empieza a contar en cuanto lo tenga.
   */
  preliminares: defineTable({
    modelKey: v.string(),
    effort: effortValidator,
    metric: metricValidator,
    /** 0..1, como las observaciones. */
    value: v.number(),
    /** El anuncio, el paper o la tabla de donde sale el número. */
    fuenteUrl: v.optional(v.string()),
    /** Fecha del dato, AAAA-MM-DD. Entra en el descuento por antigüedad. */
    measuredAt: v.optional(v.string()),
    creadoEn: v.number(),
    actualizadoEn: v.number(),
  })
    .index("by_modelKey", ["modelKey"])
    .index("by_clave", ["modelKey", "effort", "metric"]),

  /**
   * El conjunto de candidatos ya armado, en trozos.
   *
   * No es un resultado: son las ENTRADAS del cálculo, la unión de `models`,
   * `variants` y `observations` reducida a los campos que `scoreAll` mira. Se
   * rehace en cada run y las consultas públicas leen de aquí.
   *
   * Existe por I/O. Armarlo en vivo obligaba a leer las tres tablas enteras en
   * cada visita, y el catálogo tiene cientos de modelos de los que los
   * benchmarks miden unas decenas: la mayor parte de esos bytes se leían para
   * tirarlos. Guardar el resultado en vez de las entradas no servía: los
   * filtros de la web vuelven a elegir sobre el subconjunto, así que harían
   * falta tantas copias como combinaciones de filtros.
   *
   * En trozos porque un documento de Convex tiene un techo de 1 MiB y esto
   * crece con cada modelo que alguien mida. Partirlo cuesta diez líneas; que
   * la ingesta empiece a fallar el día que no quepa, bastante más.
   */
  candidatos: defineTable({
    /** Número de trozo, desde 0. Ver `POR_TROZO` en scoring/recompute.ts. */
    parte: v.number(),
    generadoEn: v.number(),
    trozo: v.array(candidatoValidator),
  }).index("by_parte", ["parte"]),
});
