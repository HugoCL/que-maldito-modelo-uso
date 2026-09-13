/**
 * Tipos de la capa de datos, compartidos por los componentes y por las dos
 * fuentes que los alimentan (Convex en producción, datos semilla en local).
 *
 * Los componentes se escriben contra estos tipos y no contra Convex, así que
 * se pueden ver y revisar sin despliegue.
 */

export type Tier = "barato" | "dia_a_dia" | "bueno";
export type PerfilId = "general" | "mantenimiento" | "agentico";
export type Confianza = "alta" | "media" | "baja";

export type MetricaDeVariante = {
  metric: string;
  etiqueta: string;
  /** En porcentaje, tal como lo publica el benchmark. */
  valor: number;
  peso: number;
};

export type Variante = {
  variantKey: string;
  modelKey: string;
  modelName: string;
  creator: string;
  effort: string;
  quality: number;
  qualityLo: number;
  qualityHi: number;
  coverage: number;
  /** Fuentes distintas que midieron esta variante. */
  benchmarks: number;
  confidence: Confianza;
  cost?: number;
  costMeasured: boolean;
  costLo?: number;
  costHi?: number;
  blendedPrice?: number;
  openWeights?: boolean;
  providers: string[];
  programmingRank?: number;
  metricas: MetricaDeVariante[];
  enFrontera?: boolean;
};

export type Tarjeta = {
  tier: Tier;
  razon: string;
  razonCorta: string;
  ganador: Variante;
  /** Suplentes de esta misma tarjeta, de mejor a peor. Puede venir vacía. */
  alternativas: Variante[];
};

export type Recomendaciones = {
  perfil: PerfilId;
  perfilEtiqueta: string;
  actualizado: number | null;
  totales: { candidatos: number; elegibles: number; enFrontera: number };
  tarjetas: Tarjeta[];
  frontera: Variante[];
};

export type Modelo = {
  modelKey: string;
  slug: string;
  name: string;
  creator: string;
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
  providers: string[];
  programmingRank?: number;
};

export type FichaDeModelo = Modelo & { variantes: Variante[] };

export type Fuente = {
  id: string;
  nombre: string;
  tipo: string;
  homepage: string;
  atribucion: string;
  licencia: string;
  activa: boolean;
  nota?: string;
};

export type Metodologia = {
  metricas: Array<{
    metric: string;
    etiqueta: string;
    peso: number;
    vidaMediaMeses: number | null;
  }>;
  /** `mide` son las etiquetas de los benchmarks que cuentan en ese perfil. */
  perfiles: Array<{ id: string; etiqueta: string; mide: string[] }>;
  /** Los umbrales que deciden quién puede ser respuesta, tal cual se aplican. */
  umbrales: {
    benchmarksMinimos: number;
    pisoCalidadBarato: number;
    pisoCalidadDiaADia: number;
    percentilCostoBarato: number;
  };
  /** Mezcla de tokens con la que se estima el costo de lo no medido. */
  mezclaDeTokens: { cacheRead: number; input: number; output: number };
  fuentes: Fuente[];
};

export type ResultadoDeFuente = {
  sourceId: string;
  status: "ok" | "sin_cambios" | "error" | "omitida";
  observations?: number;
  unresolved?: number;
  durationMs?: number;
  error?: string;
};

export type EstadoDelPipeline = {
  ultimaCorrida: {
    startedAt: number;
    finishedAt?: number;
    trigger: "cron" | "manual";
    results: ResultadoDeFuente[];
  } | null;
  fuentes: Array<{
    sourceId: string;
    enabled: boolean;
    lastRunAt?: number;
    lastOkAt?: number;
    lastError?: string;
    consecutiveFailures?: number;
  }>;
  sinResolver: Array<{
    sourceId: string;
    sourceKey: string;
    suggestion?: string;
    suggestionScore?: number;
    timesSeen: number;
  }>;
};
