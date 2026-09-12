import type { Metric } from "../sources/types";

/**
 * Toda la metodología, en un archivo que se puede cambiar sin tocar el resto.
 * Si una recomendación se ve mal, el problema casi siempre está aquí.
 */

export type MetricConfig = {
  weight: number;
  label: string;
  /**
   * Vida media en meses para el descuento por antigüedad. Un benchmark que
   * lleva medio año sin correrse no dice lo mismo que uno de esta semana.
   * `null` = no se descuenta (la fuente se actualiza en continuo).
   */
  halfLifeMonths: number | null;
};

export const METRIC_CONFIG: Record<Metric, MetricConfig> = {
  // Tareas ambiguas multi-archivo de sesiones reales. Lo más cercano al trabajo.
  "cursorbench.score": { weight: 0.3, label: "CursorBench 4.0", halfLifeMonths: null },
  // Tareas largas en 91 repos, 4 corridas completas, con intervalos publicados.
  "deepswe.pass_at_1": { weight: 0.25, label: "DeepSWE v1.1", halfLifeMonths: null },
  // Trabajo agéntico de terminal de punta a punta.
  "terminalbench.accuracy": { weight: 0.2, label: "Terminal-Bench 2.0", halfLifeMonths: null },
  // Tareas nuevas cada mes: la señal que resiste contaminación.
  "swerebench.resolved_rate": { weight: 0.15, label: "SWE-rebench", halfLifeMonths: 12 },
  // El clásico. Mide agente+modelo y se actualiza despacio: pesa poco y decae.
  "swebench_verified.resolved": { weight: 0.1, label: "SWE-bench Verified", halfLifeMonths: 9 },
  // Apagada por licencia. Ver convex/sources/artificialAnalysis.ts.
  "aa.coding_index": { weight: 0, label: "Artificial Analysis", halfLifeMonths: null },
};

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
 * No todo "$ por tarea" mide lo mismo. DeepSWE y CursorBench cuestan tareas
 * largas y ambiguas con un andamio fijo, así que sus cifras se pueden poner
 * una al lado de la otra. El `instance_cost` de SWE-bench Verified, en cambio,
 * lo reporta cada quien con su propio andamio sobre tareas mucho más fáciles:
 * mezclarlo hace aparecer modelos "baratísimos" que no lo son. Se sigue
 * guardando y mostrando en la ficha del modelo, pero no entra al eje de costo.
 */
export const COST_TRUSTED_SOURCES = ["deepswe", "cursorbench", "terminalbench"];

export const THRESHOLDS = {
  /** Debajo de esta cobertura de pesos, la variante no puede ganar tarjeta. */
  coberturaMinima: 0.5,
  /** Cobertura a partir de la cual la confianza se considera alta. */
  coberturaAlta: 0.7,
  /** "Barato" no recomienda basura: mínimo 60% de la calidad del líder. */
  pisoCalidadBarato: 0.6,
  /** "Día a día" no baja de 75% de la calidad del líder. */
  pisoCalidadDiaADia: 0.75,
  /** "Barato" se limita al tercio más económico. */
  percentilCostoBarato: 0.33,
};

/** Perfiles de tarea: reordenan los pesos sin cambiar el motor. */
export type PerfilId = "general" | "mantenimiento" | "agentico" | "greenfield";

export const PERFILES: Record<PerfilId, { label: string; pesos: Partial<Record<Metric, number>> }> = {
  general: { label: "Cualquier cosa", pesos: {} },
  mantenimiento: {
    label: "Mantenimiento y bugs",
    // Arreglar issues reales en repos ajenos: eso es exactamente SWE-*.
    pesos: {
      "swerebench.resolved_rate": 0.3,
      "swebench_verified.resolved": 0.15,
      "cursorbench.score": 0.3,
      "deepswe.pass_at_1": 0.25,
      "terminalbench.accuracy": 0.1,
    },
  },
  agentico: {
    label: "Agente suelto",
    // Correr solo, muchos pasos, terminal incluida.
    pesos: {
      "terminalbench.accuracy": 0.35,
      "deepswe.pass_at_1": 0.35,
      "cursorbench.score": 0.25,
      "swerebench.resolved_rate": 0.1,
      "swebench_verified.resolved": 0.05,
    },
  },
  greenfield: {
    label: "Código nuevo",
    // Escribir de cero se parece más a las tareas largas y ambiguas.
    pesos: {
      "deepswe.pass_at_1": 0.35,
      "cursorbench.score": 0.4,
      "terminalbench.accuracy": 0.15,
      "swerebench.resolved_rate": 0.1,
    },
  },
};

export function pesosDelPerfil(perfil: PerfilId): Record<Metric, number> {
  const base = Object.fromEntries(
    Object.entries(METRIC_CONFIG).map(([m, c]) => [m, c.weight]),
  ) as Record<Metric, number>;
  return { ...base, ...PERFILES[perfil].pesos };
}
