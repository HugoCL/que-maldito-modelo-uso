import type { Metric } from "../sources/types";

/**
 * Toda la metodología, en un archivo que se puede cambiar sin tocar el resto.
 * Si una recomendación se ve mal, el problema casi siempre está aquí.
 */

export type MetricConfig = {
  label: string;
  /**
   * Si entra en el cálculo. Apagar una métrica es la única forma de que deje
   * de contar: no hay pesos con los que hundirla a medias.
   */
  activa: boolean;
  /**
   * Vida media en meses para el descuento por antigüedad. Un benchmark que
   * lleva medio año sin correrse no dice lo mismo que uno de esta semana.
   * `null` = no se descuenta (la fuente se actualiza en continuo).
   */
  halfLifeMonths: number | null;
  /**
   * Un defecto de cobertura conocido de la fuente, escrito para leerse.
   *
   * Cuando una métrica lo tiene, la web ofrece apagarla y enseña este texto al
   * lado. No es lo mismo que `activa: false`: la fuente sigue midiendo y sus
   * cifras siguen siendo buenas, pero no llega a todos los modelos por igual,
   * y quien compara tiene derecho a ver el conjunto sin ella.
   *
   * Es la única clase de interruptor que este archivo admite en la web. Un
   * control que reparte benchmarks por corazonada, como los perfiles de tarea
   * que hubo aquí, no se puede defender; uno que apaga una fuente por un
   * agujero comprobable de cobertura, sí.
   */
  sesgo?: string;
};

/**
 * Los benchmarks que sabemos leer. Ninguno pesa más que otro.
 *
 * Nadie sabe si CursorBench vale exactamente 1.2 veces lo que vale DeepSWE, y
 * un número con dos decimales parece medido aunque esté inventado. Los que
 * entran valen lo mismo. Lo único que se decide es cuáles entran: una decisión
 * discreta, que se explica en una frase y se audita mirando esta lista.
 */
export const METRIC_CONFIG: Record<Metric, MetricConfig> = {
  // Tareas ambiguas multi-archivo de sesiones reales. Lo más cercano al trabajo.
  "cursorbench.score": {
    label: "CursorBench 4.0",
    activa: true,
    halfLifeMonths: null,
    sesgo:
      "CursorBench ya no puede medir modelos de OpenAI, así que pon no cuenta si quieres evitar sesgos.",
  },
  // Tareas largas en 91 repos, 4 corridas completas, con intervalos publicados.
  "deepswe.pass_at_1": { label: "DeepSWE v1.1", activa: true, halfLifeMonths: null },
  // Trabajo agéntico de terminal de punta a punta.
  "terminalbench.accuracy": { label: "Terminal-Bench 4.0", activa: true, halfLifeMonths: null },
  // Apagada por licencia. Ver convex/sources/artificialAnalysis.ts.
  "aa.coding_index": { label: "Artificial Analysis", activa: false, halfLifeMonths: null },
};

export const METRICAS_ACTIVAS = (): Metric[] =>
  (Object.keys(METRIC_CONFIG) as Metric[]).filter((m) => METRIC_CONFIG[m].activa);

/** Las que se pueden apagar desde la web, o sea las que declaran un `sesgo`. */
export const METRICAS_APAGABLES = (): Metric[] =>
  METRICAS_ACTIVAS().filter((m) => METRIC_CONFIG[m].sesgo !== undefined);

/**
 * La parte de la clave de métrica que nombra a la fuente: `cursorbench.score`
 * es `cursorbench`. Es lo que viaja en la URL, porque `?sin=cursorbench` se
 * lee y `?sin=cursorbench.score` no.
 */
export const fuenteDeMetrica = (metric: Metric): string => metric.split(".")[0];

/**
 * El mínimo de benchmarks que pide la URL, acotado a lo que tiene sentido.
 * Cualquier otra cosa cae en el valor por defecto en vez de dar un error: un
 * parámetro raro no debería poder cambiar la metodología.
 */
export function minimoDeBenchmarks(pedido: number | undefined): number {
  if (pedido === undefined) return THRESHOLDS.benchmarksMinimos;
  const n = Math.floor(pedido);
  return n >= THRESHOLDS.benchmarksMinimosSuelo && n <= THRESHOLDS.benchmarksMinimos
    ? n
    : THRESHOLDS.benchmarksMinimos;
}

/** De los identificadores de la URL a las métricas que hay que dejar fuera. */
export function metricasExcluidas(fuentes: string[] | undefined): Metric[] {
  if (!fuentes?.length) return [];
  return METRICAS_APAGABLES().filter((m) => fuentes.includes(fuenteDeMetrica(m)));
}

/**
 * Mezcla de tokens de una sesión agéntica de código, para convertir precios de
 * lista en un número comparable.
 *
 * No es una suposición: DeepSWE publica el desglose real por corrida y sale
 * alrededor de 4.2M de tokens de entrada por tarea, de los cuales ~4.0M son
 * lecturas de caché. El clásico 3:1 entrada:salida se equivoca por casi un
 * orden de magnitud en este tipo de carga.
 */
export const TOKEN_MIX = { cacheRead: 0.7, input: 0.2, output: 0.1 };

/** Cuando el modelo no publica precio de caché, se cae al reparto de siempre. */
export const TOKEN_MIX_SIN_CACHE = { input: 0.75, output: 0.25 };

/**
 * Fuentes cuyo costo por tarea es comparable entre sí.
 *
 * No todo "$ por tarea" mide lo mismo: hace falta que el andamio sea el mismo
 * y que las tareas se parezcan. Estas tres cuestan tareas largas y ambiguas
 * con un andamio fijo, así que sus cifras se pueden poner una al lado de la
 * otra. Una fuente nueva no entra aquí por defecto: entra cuando se ha mirado
 * cómo mide.
 */
export const COST_TRUSTED_SOURCES = ["deepswe", "cursorbench", "terminalbench"];

export const THRESHOLDS = {
  /**
   * Benchmarks distintos que tiene que haber medido a una variante para que
   * pueda ganar tarjeta.
   *
   * Se cuentan fuentes y no fracciones de peso. Con los pesos iguales, "la
   * mitad de los pesos" se cumpliría con un benchmark y medio, y un modelo con
   * dos de tres pasaría igual que uno con uno de dos: la regla dejaría de
   * decir lo único que quiere decir, que es cuántos lo han medido.
   */
  benchmarksMinimos: 2,
  /** Lo más bajo que la web deja poner ese mínimo. Uno es "todo lo medido". */
  benchmarksMinimosSuelo: 1,
  /** "Barato" no recomienda basura: mínimo 60% de la calidad del líder. */
  pisoCalidadBarato: 0.6,
  /** "Día a día" no baja de 75% de la calidad del líder. */
  pisoCalidadDiaADia: 0.75,
  /** "Barato" se limita al tercio más económico. */
  percentilCostoBarato: 0.33,
};

/**
 * Reparto a partes iguales entre los benchmarks activos.
 *
 * Aquí hubo perfiles de tarea, que decidían qué benchmarks contaban según si
 * ibas a arreglar bugs o a dejar un agente suelto. Se quitaron porque esa
 * asignación era exactamente el pecado que este archivo dice no cometer:
 * afirmar que Terminal-Bench mide el trabajo sin supervisión y CursorBench no
 * es una opinión sin medir, igual de indefendible que decir que uno vale 0.35
 * y otro 0.30. Un control que reparte los benchmarks por corazonada da tres
 * respuestas distintas y ninguna razón para preferir una.
 *
 * Lo que queda es lo único que se sostiene: todo lo que hay medido cuenta, y
 * cuenta lo mismo.
 */
export function pesosIguales(sinMetricas: Metric[] = []): Record<Metric, number> {
  const cuentan = METRICAS_ACTIVAS().filter((m) => !sinMetricas.includes(m));
  const peso = cuentan.length ? 1 / cuentan.length : 0;

  return Object.fromEntries(
    (Object.keys(METRIC_CONFIG) as Metric[]).map((m) => [m, cuentan.includes(m) ? peso : 0]),
  ) as Record<Metric, number>;
}
