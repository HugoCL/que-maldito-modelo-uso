import type { Effort, Metric } from "../sources/types";
import type { Candidate } from "./compute";

/**
 * Cómo entran los valores preliminares en el conjunto de candidatos.
 *
 * Sin nada de Convex dentro, para que los tests lleguen aquí sin arrastrar
 * `../_generated/` (ver `ingest/comparar.ts`).
 */

export type Preliminar = {
  modelKey: string;
  effort: Effort;
  metric: Metric;
  value: number;
  fuenteUrl?: string;
  measuredAt?: string;
};

/** Lo que hace falta del catálogo para armar una variante que nadie ha medido. */
export type ModeloDelCatalogo = Pick<
  Candidate,
  "modelKey" | "modelName" | "creator" | "pricing" | "providers" | "openWeights" | "programmingRank"
>;

export type EstadoDelPreliminar =
  /** Entra en la nota. */
  | { tipo: "cuenta" }
  /** El benchmark ya publicó esta métrica para este modelo: manda la suya. */
  | { tipo: "reemplazado"; porEffort: Effort }
  /** El catálogo todavía no tiene el `modelKey`: contará cuando lo tenga. */
  | { tipo: "sin_modelo" };

/** Las lecturas oficiales, por variante y por modelo, para decidir quién manda. */
function oficiales(candidatos: Candidate[]) {
  const porVariante = new Set<string>();
  const porModelo = new Map<string, Effort>();
  for (const c of candidatos) {
    for (const m of c.metrics) {
      if (m.preliminar) continue;
      porVariante.add(`${c.variantKey}::${m.metric}`);
      if (!porModelo.has(`${c.modelKey}::${m.metric}`)) {
        porModelo.set(`${c.modelKey}::${m.metric}`, c.effort);
      }
    }
  }
  return { porVariante, porModelo };
}

/**
 * Si un preliminar cuenta, y si no, por qué.
 *
 * El valor oficial sobrescribe al preliminar de la misma métrica, que es la
 * razón de ser de un preliminar: tapar el hueco hasta que el benchmark mida.
 * Es por métrica y no por modelo, porque los benchmarks no publican a la vez:
 * si DeepSWE ya lo midió y Terminal-Bench no, el preliminar de Terminal-Bench
 * sigue contando.
 *
 * Un preliminar sin effort (`default`) lo sobrescribe cualquier effort que el
 * benchmark haya medido. El laboratorio casi nunca dice con qué nivel corrió
 * su tabla, y sin esta regla el modelo se quedaba para siempre con una fila
 * «sin niveles de effort» al lado de las medidas de verdad.
 */
export function estadoDelPreliminar(
  p: Preliminar,
  candidatos: Candidate[],
  enElCatalogo: (modelKey: string) => boolean,
  lecturas = oficiales(candidatos),
): EstadoDelPreliminar {
  if (lecturas.porVariante.has(`${p.modelKey}@${p.effort}::${p.metric}`)) {
    return { tipo: "reemplazado", porEffort: p.effort };
  }
  if (p.effort === "default") {
    const porEffort = lecturas.porModelo.get(`${p.modelKey}::${p.metric}`);
    if (porEffort) return { tipo: "reemplazado", porEffort };
  }
  if (!enElCatalogo(p.modelKey)) return { tipo: "sin_modelo" };
  return { tipo: "cuenta" };
}

/**
 * Los candidatos medidos, con los preliminares que siguen contando encima.
 *
 * Un preliminar de una variante que ya existe se le suma como una métrica más;
 * uno de una variante que ningún benchmark ha medido crea la variante, con los
 * datos del catálogo y sin costo medido (el costo sale del precio de lista,
 * como el de cualquier modelo que nadie ha costeado todavía).
 *
 * El orden final es por `variantKey`, igual que el de los candidatos: los
 * empates de calidad se rompen por posición.
 */
export function sumarPreliminares(
  candidatos: Candidate[],
  preliminares: Preliminar[],
  catalogo: Map<string, ModeloDelCatalogo>,
): Candidate[] {
  if (preliminares.length === 0) return candidatos;

  const lecturas = oficiales(candidatos);
  const porVariante = new Map(
    candidatos.map((c) => [c.variantKey, { ...c, metrics: [...c.metrics] }]),
  );

  for (const p of preliminares) {
    const estado = estadoDelPreliminar(p, candidatos, (k) => catalogo.has(k), lecturas);
    if (estado.tipo !== "cuenta") continue;

    const variantKey = `${p.modelKey}@${p.effort}`;
    let c = porVariante.get(variantKey);
    if (!c) {
      const modelo = catalogo.get(p.modelKey)!;
      c = { ...modelo, variantKey, effort: p.effort, metrics: [], costSamples: [] };
      porVariante.set(variantKey, c);
    }
    c.metrics.push({
      metric: p.metric,
      value: p.value,
      measuredAt: p.measuredAt,
      preliminar: true,
      fuenteUrl: p.fuenteUrl,
    });
  }

  return [...porVariante.values()].sort((a, b) => a.variantKey.localeCompare(b.variantKey));
}
