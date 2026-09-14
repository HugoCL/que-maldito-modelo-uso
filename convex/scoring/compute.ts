import type { Effort, Metric } from "../sources/types";
import {
  COST_TRUSTED_SOURCES,
  METRICAS_ACTIVAS,
  METRIC_CONFIG,
  THRESHOLDS,
  TOKEN_MIX,
  TOKEN_MIX_SIN_CACHE,
  pesosIguales,
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
  /**
   * Lo que se le resta a este benchmark por puntuar más alto o más bajo que los
   * demás sobre los modelos que comparten. En las mismas unidades que
   * `normalized`. Ver `resolverDesniveles`.
   */
  desnivel: number;
  weight: number;
  /** Los extremos del conjunto con los que se reescaló. Sin ellos el 0-100 no
      se puede comprobar: es un número sin unidad. */
  min: number;
  max: number;
};

export type Scored = Candidate & {
  quality: number;
  /**
   * La media nivelada ya promediada con el centro, antes del último estirón.
   *
   * Es el único paso de la nota que no se veía en ninguna parte: el desglose de
   * la ficha llegaba hasta la media y la nota aparecía después sin nada en
   * medio. Va en las unidades de los benchmarks nivelados, o sea las mismas que
   * la media, para que la resta entre las dos signifique algo.
   */
  acercada: number;
  qualityLo: number;
  qualityHi: number;
  coverage: number;
  /** Fuentes distintas que midieron esta variante. */
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
 * Todo lo que se mide del conjunto entero y no de una variante suelta.
 *
 * Se calcula una vez en `scoreAll` y se le pasa a cada variante. Que viva en un
 * solo objeto no es orden por el orden: es la garantía de que ninguna de estas
 * cinco cosas se cuela calculada sobre un subconjunto filtrado, que es el error
 * que haría que la nota de un modelo cambiara al mover un control de la web.
 */
export type Escala = {
  bounds: Bounds;
  /** Cuánto puntúa de más cada benchmark. Ver `resolverDesniveles`. */
  desniveles: Record<string, number>;
  /** El centro del conjunto, ya nivelado. Es a donde tiran las notas flojas de evidencia. */
  centro: number;
  /** Cuánto tiran. Ver `cuantoEncoger`. */
  k: number;
  /** Extremos de la nota ya nivelada y encogida, para devolverla a 0-100. */
  extremos: { min: number; max: number };
  /** Lo mismo que `desniveles` para el costo, en logaritmo: ×1.44 se guarda como ln(1.44). */
  desnivelesDeCosto: Record<string, number>;
  costFactor?: number;
};

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

function mediana(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const media = (values: number[]): number | undefined =>
  values.length ? values.reduce((a, x) => a + x, 0) / values.length : undefined;

const menor = (values: number[]) => values.reduce((a, x) => Math.min(a, x), Infinity);
const mayor = (values: number[]) => values.reduce((a, x) => Math.max(a, x), -Infinity);

/** Una variante vista por el solucionador de desniveles: sus lecturas y de quién. */
type Fila = { ns: Array<{ k: string; v: number }> };

/** Vueltas máximas del solucionador, y cuándo se considera que ya no se mueve. */
const MAX_VUELTAS = 100;
const TOLERANCIA = 1e-12;

/**
 * Cuánto puntúa de más o de menos cada fuente sobre los modelos que comparte
 * con otra.
 *
 * El problema que resuelve: reescalar cada benchmark contra su propio peor y su
 * propio mejor resultado da por hecho que los tres miden al mismo grupo, y no
 * es verdad. Hoy DeepSWE es el único que mide los open weight flojos, así que su
 * suelo se hunde y eso empuja hacia arriba a todos los que mide. El resultado es
 * que un 70 de DeepSWE y un 70 de CursorBench no valen lo mismo, y promediarlos
 * hace que la nota dependa de *qué* benchmarks te midieron y no de cómo rendiste.
 *
 * Se ajusta `v ≈ mu[i] + delta[k]` por medianas alternadas: la parte que es del
 * modelo y la parte que es de la fuente. La mediana y no la media porque un solo
 * modelo raro no puede mover la escala de una fuente entera.
 *
 * Tres detalles que parecen de adorno y no lo son:
 *
 * - Solo informan las variantes con dos o más lecturas. Una fila con una sola
 *   medición tiene un residuo que vale exactamente `delta[k]`, así que se
 *   retroalimenta y duplica el desnivel en cada vuelta hasta desbordar.
 * - El residuo es `v - delta[k] - mu[i]`, no `v - mu[i]`.
 * - El desnivel del ancla se vuelve a poner a cero en cada vuelta. El ajuste es
 *   el mismo si se suma una constante a todos los `mu` y se resta de todos los
 *   `delta`, así que sin fijar uno el nivel común se va a la deriva.
 *
 * El ancla es la fuente de mayor cobertura, y eso deja la escala donde ya
 * estaba: lo que se mueve es lo que mide a menos gente.
 */
export function resolverDesniveles(
  filas: Fila[],
  claves: string[],
  ancla: string,
): Record<string, number> {
  const d: Record<string, number> = {};
  for (const k of claves) d[k] = 0;

  const informan = filas.filter((f) => f.ns.length >= 2);
  if (informan.length === 0) return d;

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const mu = informan.map((f) => mediana(f.ns.map((x) => x.v - (d[x.k] ?? 0)))!);

    let paso = 0;
    for (const k of claves) {
      const residuos: number[] = [];
      for (const [i, f] of informan.entries()) {
        for (const x of f.ns) if (x.k === k) residuos.push(x.v - (d[k] ?? 0) - mu[i]);
      }
      const m = mediana(residuos);
      if (m === undefined) continue;
      d[k] += m;
      paso = Math.max(paso, Math.abs(m));
    }

    const base = d[ancla] ?? 0;
    for (const k of claves) d[k] -= base;

    if (paso < TOLERANCIA) break;
  }

  return d;
}

/** La clave que más veces aparece: la fuente que mide a más gente. */
function conMasCobertura(filas: Fila[], claves: string[]): string {
  const cuenta = new Map<string, number>();
  for (const f of filas) for (const x of f.ns) cuenta.set(x.k, (cuenta.get(x.k) ?? 0) + 1);
  return claves.reduce((a, b) => ((cuenta.get(b) ?? 0) > (cuenta.get(a) ?? 0) ? b : a), claves[0]);
}

/**
 * Cuánto acercar al centro una nota según la evidencia que la sostiene.
 *
 * `k` es la varianza entre los benchmarks de un mismo modelo dividida por la
 * varianza entre modelos: cuánto se contradicen los benchmarks comparado con
 * cuánto se diferencian los modelos. No lo elegimos nosotros, sale de los datos
 * de hoy, que es la única forma de que este número no sea otra corazonada con
 * dos decimales.
 *
 * Si los benchmarks se contradijeran poco (`k` cerca de 0) no habría nada que
 * corregir: dos mediciones bastarían. Cuanto más se contradicen, más hay que
 * desconfiar de una media hecha con pocas, y más se acerca al centro.
 *
 * Se mide sobre los valores YA nivelados. Antes de nivelar, casi todo el
 * "desacuerdo" entre benchmarks es en realidad el desnivel entre sus escalas, y
 * `k` sale varias veces más grande de lo que es.
 */
export function cuantoEncoger(lecturas: number[][]): number {
  const conVarias = lecturas.filter((vs) => vs.length >= 2);
  if (conVarias.length < 2) return 0;

  let dentro = 0;
  let grados = 0;
  const medias: number[] = [];
  for (const vs of conVarias) {
    const mu = media(vs)!;
    medias.push(mu);
    for (const v of vs) dentro += (v - mu) ** 2;
    grados += vs.length - 1;
  }
  if (grados === 0) return 0;

  const mg = media(medias)!;
  const entre = medias.reduce((a, x) => a + (x - mg) ** 2, 0) / (medias.length - 1);
  if (!(entre > 0)) return 0;

  return dentro / grados / entre;
}

/** La media tira hacia el centro cuanta menos evidencia la sostiene. */
const encoger = (mu: number, evidencia: number, centro: number, k: number) =>
  evidencia + k > 0 ? (evidencia * mu + k * centro) / (evidencia + k) : centro;

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
 * El costo de una variante, una lectura por fuente y en logaritmo.
 *
 * Se colapsan las lecturas repetidas de una misma fuente antes de nada: si no,
 * una fuente que publicó dos veces el mismo modelo pesaría el doble que las
 * otras en la mediana sin que nadie lo haya decidido.
 */
function costesPorFuente(samples: CostSample[]): Array<{ k: string; v: number }> {
  const porId = new Map<string, number[]>();
  for (const s of samples) {
    if (!COST_TRUSTED_SOURCES.includes(s.sourceId)) continue;
    // Un costo de cero o negativo es un agujero en la fuente, no una ganga, y
    // además no tiene logaritmo.
    if (!(s.costPerTask > 0)) continue;
    porId.set(s.sourceId, [...(porId.get(s.sourceId) ?? []), Math.log(s.costPerTask)]);
  }
  return [...porId].map(([k, vs]) => ({ k, v: mediana(vs)! }));
}

/**
 * El costo por tarea, ya en la misma escala venga de la fuente que venga.
 *
 * Las tareas de un benchmark no son las de otro: hoy las de CursorBench cuestan
 * alrededor de un 44% más que las de DeepSWE para el mismo modelo, y las de
 * Terminal-Bench un 58% más. Sacar la mediana entre fuentes sin más hacía que un
 * modelo pareciera más caro solo por quién lo hubiera costeado.
 *
 * Se nivela en logaritmo porque la diferencia entre fuentes es multiplicativa:
 * una fuente no cuesta dos dólares más, cuesta 1.44 veces.
 */
function costoNivelado(
  samples: CostSample[],
  desniveles: Record<string, number>,
): { punto?: number; lo?: number; hi?: number } {
  const ns = costesPorFuente(samples);
  if (!ns.length) return {};

  const nivelados = ns.map((x) => x.v - (desniveles[x.k] ?? 0));
  const punto = Math.exp(mediana(nivelados)!);
  if (nivelados.length < 2) return { punto };
  return { punto, lo: Math.exp(menor(nivelados)), hi: Math.exp(mayor(nivelados)) };
}

/**
 * Factor que convierte precio de lista en costo por tarea, ajustado contra los
 * costos que sí están medidos.
 *
 * Es la mediana de las razones en logaritmo, o sea "cuántas veces el precio de
 * lista acaba costando una tarea, en el caso típico". Aquí hubo unos mínimos
 * cuadrados por el origen, y el problema de ajustar una relación multiplicativa
 * sumando cuadrados es que los modelos de veinte dólares la tarea pesan cientos
 * de veces más que los de treinta centavos: el factor salía puesto por media
 * docena de modelos caros. Con la mediana el modelo típico decide, y el error
 * relativo típico baja de más del 100% a un 85%.
 */
export function calibrateCostFactor(
  candidates: Candidate[],
  desnivelesDeCosto: Record<string, number>,
): number | undefined {
  const razones: number[] = [];
  for (const c of candidates) {
    const price = blendedPrice(c.pricing);
    const { punto } = costoNivelado(c.costSamples, desnivelesDeCosto);
    if (price === undefined || punto === undefined || price <= 0) continue;
    razones.push(Math.log(punto / price));
  }
  const m = mediana(razones);
  return m === undefined ? undefined : Math.exp(m);
}

/**
 * La media nivelada de una variante, antes de encoger y de volver a 0-100.
 *
 * Es el paso que comparten las dos pasadas de `scoreAll`: la que mide el
 * conjunto y la que puntúa a cada uno. Devuelve `undefined` cuando no queda
 * ningún benchmark que cuente, que no es lo mismo que sacar cero.
 */
function nivelar(
  c: Candidate,
  escala: Pick<Escala, "bounds" | "desniveles">,
  now: number,
  sinMetricas: Metric[],
) {
  const pesos = pesosIguales(sinMetricas);
  const cuentan = Object.values(pesos).filter((p) => p > 0).length;

  let sum = 0;
  let sumLo = 0;
  let sumHi = 0;
  let totalWeight = 0;
  const breakdown: MetricBreakdown[] = [];
  const nivelados: number[] = [];

  for (const m of c.metrics) {
    const base = pesos[m.metric] ?? 0;
    if (base <= 0) continue;
    const weight = base * decay(m.measuredAt, METRIC_CONFIG[m.metric].halfLifeMonths, now);
    if (weight <= 0) continue;

    const desnivel = escala.desniveles[m.metric] ?? 0;
    const n = normalize(m.value, m.metric, escala.bounds);
    // La banda se propaga con la misma transformación; sin intervalo publicado,
    // el punto hace de banda y no inventamos incertidumbre que no medimos.
    const lo = m.ciLo !== undefined ? normalize(m.ciLo, m.metric, escala.bounds) : n;
    const hi = m.ciHi !== undefined ? normalize(m.ciHi, m.metric, escala.bounds) : n;

    // Sin recortar a 0-1 después de quitar el desnivel: recortar aquí
    // aplastaría contra el techo a todo el tramo alto. La escala 0-100 se
    // recupera al final, sobre la nota ya encogida.
    sum += (n - desnivel) * weight;
    sumLo += (lo - desnivel) * weight;
    sumHi += (hi - desnivel) * weight;
    totalWeight += weight;
    nivelados.push(n - desnivel);

    const b = escala.bounds[m.metric];
    breakdown.push({
      metric: m.metric,
      value: m.value,
      normalized: n,
      desnivel,
      weight,
      min: b?.min ?? m.value,
      max: b?.max ?? m.value,
    });
  }

  if (totalWeight <= 0) return undefined;

  return {
    mu: sum / totalWeight,
    muLo: sumLo / totalWeight,
    muHi: sumHi / totalWeight,
    // Cuántas mediciones sostienen la nota. Es la cuenta de benchmarks salvo
    // que alguno esté descontado por viejo, y entonces cuenta menos de uno:
    // con los pesos iguales, `totalWeight * cuentan` es justo la suma de los
    // descuentos por antigüedad.
    evidencia: totalWeight * cuentan,
    coverage: totalWeight,
    nivelados,
    breakdown,
  };
}

/**
 * Lo que se mide del conjunto entero: los extremos de cada benchmark, su
 * desnivel, el centro al que tiran las notas flojas, cuánto tiran y los
 * extremos finales.
 *
 * Todo sale del universo completo. Los desniveles se calculan además con TODAS
 * las métricas activas, también las que el visitante haya apagado: apagar
 * CursorBench no puede cambiar en qué escala está la nota de DeepSWE de un
 * modelo, solo dejar de promediarla con la otra.
 */
export function construirEscala(
  candidates: Candidate[],
  now: number = Date.now(),
  sinMetricas: Metric[] = [],
): Escala {
  const bounds = computeBounds(candidates);

  const claves = METRICAS_ACTIVAS() as string[];
  const filas: Fila[] = candidates.map((c) => ({
    ns: c.metrics
      .filter((m) => claves.includes(m.metric))
      .map((m) => ({ k: m.metric as string, v: normalize(m.value, m.metric, bounds) })),
  }));
  const desniveles = claves.length
    ? resolverDesniveles(filas, claves, conMasCobertura(filas, claves))
    : {};

  const costeFilas: Fila[] = candidates.map((c) => ({ ns: costesPorFuente(c.costSamples) }));
  const desnivelesDeCosto = resolverDesniveles(
    costeFilas,
    COST_TRUSTED_SOURCES,
    conMasCobertura(costeFilas, COST_TRUSTED_SOURCES),
  );

  // Primera pasada: hace falta el conjunto entero puntuado para saber dónde
  // está su centro, cuánto se contradicen los benchmarks y entre qué dos
  // valores hay que estirar la nota final.
  const crudas = candidates
    .map((c) => nivelar(c, { bounds, desniveles }, now, sinMetricas))
    .filter((x): x is NonNullable<typeof x> => x !== undefined);

  const centro = media(crudas.map((x) => x.mu)) ?? 0;
  const k = cuantoEncoger(crudas.map((x) => x.nivelados));
  const finales = crudas.map((x) => encoger(x.mu, x.evidencia, centro, k));
  const extremos = finales.length
    ? { min: menor(finales), max: mayor(finales) }
    : { min: 0, max: 1 };

  return {
    bounds,
    desniveles,
    centro,
    k,
    extremos,
    desnivelesDeCosto,
    costFactor: calibrateCostFactor(candidates, desnivelesDeCosto),
  };
}

/**
 * La escala en las unidades en las que se enseña.
 *
 * Los desniveles van en puntos de la escala de 0 a 100 de cada benchmark, que
 * es la misma unidad que usa el desglose de la ficha de modelo; el desnivel de
 * costo va como factor ("×1.44") porque es multiplicativo; y el centro se
 * traslada a la escala final, que es donde el lector lo puede situar.
 */
export function escalaPublica(escala: Escala) {
  const ancho = escala.extremos.max - escala.extremos.min;
  return {
    desniveles: Object.fromEntries(
      Object.entries(escala.desniveles).map(([k, v]) => [k, v * 100]),
    ),
    costePorFuente: Object.fromEntries(
      Object.entries(escala.desnivelesDeCosto).map(([k, v]) => [k, Math.exp(v)]),
    ),
    centro: ancho > 0 ? ((escala.centro - escala.extremos.min) / ancho) * 100 : 50,
    // El mismo centro y los extremos del último estirón, pero en las unidades
    // del desglose de la ficha: ahí la cuenta se hace desde la media nivelada,
    // que no está en la escala final, y con `centro` a secas no cuadraba.
    centroNivelado: escala.centro * 100,
    extremos: { min: escala.extremos.min * 100, max: escala.extremos.max * 100 },
    k: escala.k,
  };
}

/** El último paso: de la media ya acercada al centro a la nota de 0 a 100. */
function aEscalaFinal(acercada: number, escala: Escala): number {
  const { min, max } = escala.extremos;
  if (!(max > min)) return 50;
  return clamp01((acercada - min) / (max - min)) * 100;
}

/** Los dos pasos que van de la media nivelada a la nota que se enseña. */
const aNota = (mu: number, evidencia: number, escala: Escala): number =>
  aEscalaFinal(encoger(mu, evidencia, escala.centro, escala.k), escala);

export function scoreCandidate(
  c: Candidate,
  escala: Escala,
  now: number,
  sinMetricas: Metric[] = [],
): Scored {
  const pesos = pesosIguales(sinMetricas);
  const cuentan = Object.values(pesos).filter((p) => p > 0).length;
  const nivelada = nivelar(c, escala, now, sinMetricas);

  const breakdown = nivelada?.breakdown ?? [];
  // Cuántas fuentes distintas lo midieron, que es lo que decide si puede ser
  // una respuesta. La cobertura se sigue guardando porque dice otra cosa:
  // cuánto de lo que hay está medido, ya descontada la antigüedad.
  const benchmarks = breakdown.length;

  const { punto: measured, lo: costLo, hi: costHi } = costoNivelado(
    c.costSamples,
    escala.desnivelesDeCosto,
  );
  const price = blendedPrice(c.pricing);

  return {
    ...c,
    quality: nivelada ? aNota(nivelada.mu, nivelada.evidencia, escala) : 0,
    acercada: nivelada
      ? encoger(nivelada.mu, nivelada.evidencia, escala.centro, escala.k)
      : escala.centro,
    qualityLo: nivelada ? aNota(nivelada.muLo, nivelada.evidencia, escala) : 0,
    qualityHi: nivelada ? aNota(nivelada.muHi, nivelada.evidencia, escala) : 0,
    coverage: nivelada?.coverage ?? 0,
    benchmarks,
    confidence:
      benchmarks >= cuentan
        ? "alta"
        : benchmarks >= THRESHOLDS.benchmarksMinimos
          ? "media"
          : "baja",
    cost: measured ?? (price !== undefined && escala.costFactor ? price * escala.costFactor : undefined),
    costMeasured: measured !== undefined,
    costLo,
    costHi,
    blendedPrice: price,
    metricBreakdown: breakdown.sort((a, b) => b.weight - a.weight),
  };
}

/**
 * Dos pasadas: primero se mide el conjunto, después se puntúa a cada uno contra
 * esa medida. Lo que se mide del conjunto sale siempre del universo completo,
 * también cuando se apaga una fuente.
 */
export function scoreAll(
  candidates: Candidate[],
  now: number = Date.now(),
  sinMetricas: Metric[] = [],
): Scored[] {
  const escala = construirEscala(candidates, now, sinMetricas);
  return candidates.map((c) => scoreCandidate(c, escala, now, sinMetricas));
}
