/**
 * Tipos de la capa de datos, compartidos por los componentes y por las dos
 * fuentes que los alimentan (Convex en producción, datos semilla en local).
 *
 * Los componentes se escriben contra estos tipos y no contra Convex, así que
 * se pueden ver y revisar sin despliegue.
 */

export type Tier = "barato" | "dia_a_dia" | "bueno";
export type PerfilId = "general" | "mantenimiento" | "agentico" | "greenfield";
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
  ganador: Variante;
  segundo: Variante | null;
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
  perfiles: Array<{ id: string; etiqueta: string }>;
  fuentes: Fuente[];
};
