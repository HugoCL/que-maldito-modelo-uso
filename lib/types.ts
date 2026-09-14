/**
 * Tipos de la capa de datos, compartidos por los componentes y por las dos
 * fuentes que los alimentan (Convex en producción, datos semilla en local).
 *
 * Los componentes se escriben contra estos tipos y no contra Convex, así que
 * se pueden ver y revisar sin despliegue.
 */

export type Tier = "barato" | "dia_a_dia" | "bueno";
export type Confianza = "alta" | "media" | "baja";

export type MetricaDeVariante = {
  metric: string;
  etiqueta: string;
  /** En porcentaje, tal como lo publica el benchmark. */
  valor: number;
  peso: number;
  /** El mismo resultado reescalado de 0 a 100 contra los extremos del conjunto. */
  normalizado: number;
  /**
   * Lo que se le resta a este benchmark por puntuar más alto o más bajo que los
   * demás sobre los modelos que comparten, en puntos de esa misma escala.
   */
  desnivel: number;
  /** Peor y mejor resultado medidos en este benchmark, en porcentaje. */
  minimo: number;
  maximo: number;
};

export type Variante = {
  variantKey: string;
  modelKey: string;
  modelName: string;
  creator: string;
  effort: string;
  quality: number;
  /**
   * La media nivelada ya promediada con el centro del conjunto, en las unidades
   * del desglose. Es el escalón que falta entre la media y la calidad.
   *
   * Opcional porque un despliegue de Convex anterior a este campo no lo manda,
   * y la ficha prefiere enseñar un paso menos a romperse.
   */
  acercada?: number;
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
  /**
   * La otra tarjeta que recomienda este mismo modelo, cuando coinciden. Solo la
   * lleva la del día a día, y la fila tiene que decirlo: dos filas con el mismo
   * nombre y sin explicación se leen como un error.
   */
  repiteA?: Tier;
};

/**
 * Por qué no hay tarjeta del día a día. Son tres cosas distintas y cada una se
 * cuenta con su frase: la ausencia explicada es información, la ausencia a
 * secas parece un agujero de datos.
 */
export type MotivoSinDiaADia =
  | { tipo: "frontera_corta"; puntos: number }
  | { tipo: "sin_codo" }
  | { tipo: "bajo_el_piso"; mejor: number; piso: number };

export type Recomendaciones = {
  actualizado: number | null;
  totales: {
    candidatos: number;
    elegibles: number;
    enFrontera: number;
    /** Puntuadas por un solo benchmark: se ven, pero no optan a las tarjetas. */
    unaFuente: number;
  };
  tarjetas: Tarjeta[];
  /** Vacío cuando sí hay respuesta para el día a día. */
  sinDiaADia?: MotivoSinDiaADia;
  /** Todo lo que puede optar a una tarjeta, con la frontera marcada. */
  elegibles: Variante[];
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

/**
 * Lo que se mide del conjunto entero para poder comparar entre benchmarks.
 *
 * Lo pide /metodologia, que tiene prohibido escribir una cifra a mano: estos
 * números cambian con los datos de cada día y una página que explica el cálculo
 * no se puede quedar contando el cálculo del mes pasado.
 */
export type EscalaPublica = {
  /** Cuánto puntúa de más cada benchmark, en puntos de la escala de 0 a 100. */
  desniveles: Record<string, number>;
  /** Cuánto cuestan las tareas de cada fuente respecto al ancla, como factor. */
  costePorFuente: Record<string, number>;
  /** El centro del conjunto, de 0 a 100, al que tiran las notas con poca evidencia. */
  centro: number;
  /** Ese mismo centro en las unidades del desglose de la ficha. */
  centroNivelado?: number;
  /** Los extremos del último estirón, en esas mismas unidades: pasan a ser 0 y 100. */
  extremos?: { min: number; max: number };
  /** Cuánto tiran: varianza entre benchmarks del mismo modelo / varianza entre modelos. */
  k: number;
};

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
    /** Identificador de la fuente, el que viaja en la URL (`cursorbench`). */
    fuente: string;
    etiqueta: string;
    peso: number;
    vidaMediaMeses: number | null;
    /** Defecto de cobertura conocido. Cuando lo hay, la fuente se puede apagar. */
    sesgo?: string;
  }>;
  /** Los umbrales que deciden quién puede ser respuesta, tal cual se aplican. */
  umbrales: {
    benchmarksMinimos: number;
    /** Lo más bajo que la portada deja poner ese mínimo. */
    benchmarksMinimosSuelo: number;
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
