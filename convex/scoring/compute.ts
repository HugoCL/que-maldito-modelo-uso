import type { Effort, Metric } from "../sources/types";
import {
  COST_TRUSTED_SOURCES,
  METRIC_CONFIG,
  THRESHOLDS,
  TOKEN_MIX,
  TOKEN_MIX_SIN_CACHE,
  pesosDelPerfil,
  type PerfilId,
} from "./config";

export type MetricSample = {
  metric: Metric;
  value: number;
  ciLo?: number;
  ciHi?: number;
  measuredAt?: string;
};

export type CostSample = { sourceId: string; costPerTask: number };

export type Pricing = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
};

export type Candidate = {
  variantKey: string;
  modelKey: string;
  modelName: string;
  creator: string;
  effort: Effort;
  metrics: MetricSample[];
  costSamples: CostSample[];
  pricing?: Pricing;
  providers: string[];
  openWeights?: boolean;
  programmingRank?: number;
};

export type MetricBreakdown = {
  metric: Metric;
  value: number;
  normalized: number;
  weight: number;
};

export type Scored = Candidate & {
  quality: number;
  qualityLo: number;
  qualityHi: number;
  coverage: number;
  /** Fuentes distintas que midieron esta variante dentro del perfil. */
  benchmarks: number;
  confidence: "alta" | "media" | "baja";
  cost?: number;
  costMeasured: boolean;
  costLo?: number;
  costHi?: number;
  blendedPrice?: number;
  metricBreakdown: MetricBreakdown[];
};

/** Límites por métrica, calculados una vez sobre TODO el conjunto. */
export type Bounds = Record<string, { min: number; max: number }>;

/**
 * Los límites se fijan con el universo completo y no con el subconjunto
 * filtrado. Si no, la "calidad 87" de un modelo cambiaría al mover un filtro,
 * que es justo lo que hace desconfiar de un número.
 */
export function computeBounds(candidates: Candidate[]): Bounds {
  const bounds: Bounds = {};
  for (const c of candidates) {
    for (const m of c.metrics) {
      const b = bounds[m.metric] ?? { min: Infinity, max: -Infinity };
      b.min = Math.min(b.min, m.value);
      b.max = Math.max(b.max, m.value);
      bounds[m.metric] = b;
    }
  }
  return bounds;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function normalize(value: number, metric: Metric, bounds: Bounds): number {
  const b = bounds[metric];
  if (!b || b.max === b.min) return 0.5;
  return clamp01((value - b.min) / (b.max - b.min));
}

/** Descuento por antigüedad: 1 cuando el dato es de hoy, 0.5 a una vida media. */
export function decay(measuredAt: string | undefined, halfLifeMonths: number | null, now: number): number {
  if (!halfLifeMonths || !measuredAt) return 1;
  const t = Date.parse(measuredAt);
  if (Number.isNaN(t)) return 1;
  const months = (now - t) / (1000 * 60 * 60 * 24 * 30.44);
  if (months <= 0) return 1;
  return 0.5 ** (months / halfLifeMonths);
}

/**
 * Precio mezclado en USD por millón de tokens, con la mezcla agéntica.
 * Sirve para ordenar modelos que ningún benchmark ha costeado todavía.
 */
export function blendedPrice(pricing: Pricing | undefined): number | undefined {
  if (!pricing) return undefined;
  const { input, output, cacheRead } = pricing;
  if (input === undefined || output === undefined) return undefined;

  const mezcla =
    cacheRead !== undefined
      ? cacheRead * TOKEN_MIX.cacheRead + input * TOKEN_MIX.input + output * TOKEN_MIX.output
      : input * TOKEN_MIX_SIN_CACHE.input + output * TOKEN_MIX_SIN_CACHE.output;

  // Un precio de cero en el catálogo significa "no lo sabemos" o "es una
  // vista previa gratis", nunca "correrlo sale gratis". Un cero se cuela en la
  // frontera de Pareto y domina a todo lo demás.
  return mezcla > 0 ? mezcla : undefined;
}

/**
 * Factor que convierte precio de lista en costo por tarea, ajustado por mínimos
 * cuadrados contra los costos que sí están medidos. Es una recta por el origen:
 * una tarea consume aproximadamente los mismos tokens la corra quien la corra,
 * así que lo que cambia entre modelos es el precio.
 */
export function calibrateCostFactor(candidates: Candidate[]): number | undefined {
  let num = 0;
  let den = 0;
  for (const c of candidates) {
    const price = blendedPrice(c.pricing);
    const measured = medianCost(c.costSamples);
    if (price === undefined || measured === undefined || price <= 0) continue;
    num += price * measured;
    den += price * price;
  }
  return den > 0 ? num / den : undefined;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Solo el costo de fuentes comparables entre sí. Ver COST_TRUSTED_SOURCES. */
function medianCost(samples: CostSample[]): number | undefined {
  const trusted = samples.filter((s) => COST_TRUSTED_SOURCES.includes(s.sourceId));
  return median(trusted.map((s) => s.costPerTask));
}

export function scoreCandidate(
  c: Candidate,
  bounds: Bounds,
  perfil: PerfilId,
  costFactor: number | undefined,
  now: number,
): Scored {
  const pesos = pesosDelPerfil(perfil);

  let sum = 0;
  let sumLo = 0;
  let sumHi = 0;
  let totalWeight = 0;
  const breakdown: MetricBreakdown[] = [];

  for (const m of c.metrics) {
    const base = pesos[m.metric] ?? 0;
    if (base <= 0) continue;
    const weight = base * decay(m.measuredAt, METRIC_CONFIG[m.metric].halfLifeMonths, now);
    if (weight <= 0) continue;

    const n = normalize(m.value, m.metric, bounds);
    // La banda se propaga con la misma transformación; sin intervalo publicado,
    // el punto hace de banda y no inventamos incertidumbre que no medimos.
    const lo = m.ciLo !== undefined ? normalize(m.ciLo, m.metric, bounds) : n;
    const hi = m.ciHi !== undefined ? normalize(m.ciHi, m.metric, bounds) : n;

    sum += n * weight;
    sumLo += lo * weight;
    sumHi += hi * weight;
    totalWeight += weight;
    breakdown.push({ metric: m.metric, value: m.value, normalized: n, weight });
  }

  const coverage = totalWeight;
  // Cuántas fuentes distintas lo midieron, que es lo que decide si puede ser
  // una respuesta. La cobertura se sigue guardando porque dice otra cosa:
  // cuánto del perfil está medido, ya descontada la antigüedad.
  const benchmarks = breakdown.length;
  const delPerfil = Object.values(pesos).filter((p) => p > 0).length;
  const quality = totalWeight > 0 ? (sum / totalWeight) * 100 : 0;
  const qualityLo = totalWeight > 0 ? (sumLo / totalWeight) * 100 : 0;
  const qualityHi = totalWeight > 0 ? (sumHi / totalWeight) * 100 : 0;

  const measured = medianCost(c.costSamples);
  const price = blendedPrice(c.pricing);
  const costs = c.costSamples
    .filter((s) => COST_TRUSTED_SOURCES.includes(s.sourceId))
    .map((s) => s.costPerTask);

  return {
    ...c,
    quality,
    qualityLo,
    qualityHi,
    coverage,
    benchmarks,
    confidence:
      benchmarks >= delPerfil
        ? "alta"
        : benchmarks >= THRESHOLDS.benchmarksMinimos
          ? "media"
          : "baja",
    cost: measured ?? (price !== undefined && costFactor ? price * costFactor : undefined),
    costMeasured: measured !== undefined,
    costLo: costs.length > 1 ? Math.min(...costs) : undefined,
    costHi: costs.length > 1 ? Math.max(...costs) : undefined,
    blendedPrice: price,
    metricBreakdown: breakdown.sort((a, b) => b.weight - a.weight),
  };
}

export function scoreAll(
  candidates: Candidate[],
  perfil: PerfilId,
  now: number = Date.now(),
): Scored[] {
  const bounds = computeBounds(candidates);
  const costFactor = calibrateCostFactor(candidates);
  return candidates.map((c) => scoreCandidate(c, bounds, perfil, costFactor, now));
}
