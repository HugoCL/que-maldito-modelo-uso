import type { EFFORTS, METRICS } from "../schema";

export type Effort = (typeof EFFORTS)[number];
export type Metric = (typeof METRICS)[number];

/** Un hecho medido, tal como sale del parser y antes de resolver identidades. */
export type ParsedObservation = {
  /** La cadena exacta que usó la fuente. Se guarda para depurar el matching. */
  sourceKey: string;
  /** Lo que le pasamos al resolvedor: slug o nombre del modelo, sin el effort. */
  modelHint: string;
  effort: Effort;
  metric: Metric;
  /** Siempre 0..1. */
  value: number;
  ciLo?: number;
  ciHi?: number;
  nRuns?: number;
  costPerTask?: number;
  agentSteps?: number;
  durationSeconds?: number;
  inputTokens?: number;
  cacheReadTokens?: number;
  outputTokens?: number;
  measuredAt?: string;
};

/** Una entrada de catálogo: identidad, precios y capacidades de un modelo. */
export type ParsedCatalogEntry = {
  modelKey: string;
  name: string;
  creator: string;
  creatorSlug: string;
  family?: string;
  description?: string;
  releaseDate?: string;
  knowledgeCutoff?: string;
  openWeights?: boolean;
  contextLimit?: number;
  outputLimit?: number;
  pricing?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  supportedEfforts?: string[];
  providers?: string[];
  programmingRank?: number;
  toolCall?: boolean;
};

export type SourceKind = "catalogo" | "benchmark";

export type SourceMeta = {
  id: string;
  kind: SourceKind;
  /** Nombre para mostrar en las insignias de la UI. */
  name: string;
  /** A dónde manda el enlace de atribución. */
  homepage: string;
  /** De dónde bajamos los datos. */
  url: string;
  /** Cómo se cita la fuente. Se muestra en /creditos. */
  attribution: string;
  /** Términos relevantes, en una línea. Se muestra en /creditos. */
  license: string;
  /**
   * Encendida por defecto. Artificial Analysis viene apagada: sus términos de
   * API gratuita prohíben redistribuir, y publicar sus scores es redistribuir.
   */
  enabled: boolean;
  /** Nota de etiqueta para el ingestor (robots.txt, noindex, etc.). */
  note?: string;
};

export type CatalogSource = SourceMeta & {
  kind: "catalogo";
  parse: (body: string) => ParsedCatalogEntry[];
};

export type BenchmarkSource = SourceMeta & {
  kind: "benchmark";
  parse: (body: string) => ParsedObservation[];
};

export type Source = CatalogSource | BenchmarkSource;
