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
  "cursorbench.score": { label: "CursorBench 4.0", activa: true, halfLifeMonths: null },
  // Tareas largas en 91 repos, 4 corridas completas, con intervalos publicados.
  "deepswe.pass_at_1": { label: "DeepSWE v1.1", activa: true, halfLifeMonths: null },
  // Trabajo agéntico de terminal de punta a punta.
  "terminalbench.accuracy": { label: "Terminal-Bench 2.0", activa: true, halfLifeMonths: null },
  // Apagada por licencia. Ver convex/sources/artificialAnalysis.ts.
  "aa.coding_index": { label: "Artificial Analysis", activa: false, halfLifeMonths: null },
};

export const METRICAS_ACTIVAS = (): Metric[] =>
  (Object.keys(METRIC_CONFIG) as Metric[]).filter((m) => METRIC_CONFIG[m].activa);

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
   * Se cuentan fuentes y no fracciones de peso. En un perfil que mira dos
   * benchmarks, "la mitad de los pesos" sería un benchmark solo, justo lo que
   * esta regla existe para impedir.
   */
  benchmarksMinimos: 2,
  /** "Barato" no recomienda basura: mínimo 60% de la calidad del líder. */
  pisoCalidadBarato: 0.6,
  /** "Día a día" no baja de 75% de la calidad del líder. */
  pisoCalidadDiaADia: 0.75,
  /** "Barato" se limita al tercio más económico. */
  percentilCostoBarato: 0.33,
};

/**
 * Perfiles de tarea.
 *
 * Un perfil no reordena decimales: dice QUÉ benchmarks miden ese tipo de
 * trabajo. Los que entran siguen valiendo lo mismo entre sí. Así la pregunta
 * que hay que discutir cuando una recomendación sorprende es una que se puede
 * contestar ("¿mide Terminal-Bench el trabajo de arreglar bugs?") y no una que
 * no se puede, que es cuánto vale 0.35 frente a 0.30.
 *
 * `mide: null` = todos los benchmarks activos.
 */
export type PerfilId = "general" | "mantenimiento" | "agentico";

/**
 * Cada perfil se dice de tres maneras: `label` cuando hay sitio para una frase,
 * `corto` en la barra de la portada, que es una línea en minúscula, y
 * `descripcion` al pasar el ratón por encima. Lo de las dos voces ya lo hacen
 * los tiers en lib/i18n/es.ts; la tercera existe porque el nombre de un perfil
 * nunca va a caber en una pastilla y quien elige necesita saber qué está
 * eligiendo.
 */
export const PERFILES: Record<
  PerfilId,
  { label: string; corto: string; descripcion: string; mide: Metric[] | null }
> = {
  general: {
    label: "Cualquier cosa",
    corto: "cualquier cosa",
    descripcion: "Sin distinguir el tipo de trabajo: cuenta todo lo que hay medido.",
    mide: null,
  },
  mantenimiento: {
    label: "Arreglar bugs",
    corto: "arreglar bugs",
    descripcion:
      "Trabajo sobre código que ya existe: cerrar issues y cambios repartidos por varios archivos.",
    // DeepSWE es literalmente cerrar issues de repos ajenos y CursorBench son
    // sesiones reales multi-archivo. Los dos miden trabajo sobre código que ya
    // existe, que es de lo que va este perfil.
    mide: ["cursorbench.score", "deepswe.pass_at_1"],
  },
  agentico: {
    label: "Sin supervisión",
    corto: "sin supervisión",
    descripcion:
      "Tareas largas, de muchos pasos y con terminal, que corren sin nadie delante.",
    // Correr solo, muchos pasos, terminal incluida. CursorBench queda fuera:
    // sus tareas vienen de sesiones con alguien delante. Es el perfil más
    // exigente porque es del que menos gente publica datos.
    mide: ["terminalbench.accuracy", "deepswe.pass_at_1"],
  },
  // No hay perfil de "código nuevo" porque ningún benchmark activo mide
  // escribir de cero: DeepSWE parte de un issue con su test ya escrito y
  // CursorBench de una sesión sobre un repo que existe. Ese perfil miraría los
  // mismos dos que "mantenimiento" y daría la misma respuesta, y un control que
  // no cambia nada promete una elección que no existe.
};

/** Reparto a partes iguales entre los benchmarks que mide el perfil. */
export function pesosDelPerfil(perfil: PerfilId): Record<Metric, number> {
  const activas = METRICAS_ACTIVAS();
  const cuentan = (PERFILES[perfil].mide ?? activas).filter((m) => activas.includes(m));
  const peso = cuentan.length ? 1 / cuentan.length : 0;

  return Object.fromEntries(
    (Object.keys(METRIC_CONFIG) as Metric[]).map((m) => [m, cuentan.includes(m) ? peso : 0]),
  ) as Record<Metric, number>;
}
