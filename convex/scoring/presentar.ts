import { METRIC_CONFIG } from "./config";
import type { Scored } from "./compute";

/**
 * De una variante puntuada a lo que necesita la web para dibujarla.
 *
 * Vive aquí y no en las consultas porque hay dos sitios que puntúan: Convex en
 * producción y lib/datos.ts cuando no hay despliegue conectado. Con una copia
 * en cada uno, cualquier campo nuevo aparecía en producción y faltaba en la
 * instantánea, que es precisamente el modo en el que se revisa la web antes de
 * publicarla.
 */
export function aTarjeta(s: Scored) {
  return {
    variantKey: s.variantKey,
    modelKey: s.modelKey,
    modelName: s.modelName,
    creator: s.creator,
    effort: s.effort,
    quality: Math.round(s.quality * 10) / 10,
    // En las unidades del desglose (los benchmarks nivelados), no en las de
    // la calidad: es el paso que va de una escala a la otra.
    acercada: Math.round(s.acercada * 1000) / 10,
    qualityLo: Math.round(s.qualityLo * 10) / 10,
    qualityHi: Math.round(s.qualityHi * 10) / 10,
    coverage: Math.round(s.coverage * 100) / 100,
    benchmarks: s.benchmarks,
    confidence: s.confidence,
    cost: s.cost !== undefined ? Math.round(s.cost * 100) / 100 : undefined,
    costMeasured: s.costMeasured,
    costLo: s.costLo,
    costHi: s.costHi,
    blendedPrice: s.blendedPrice,
    openWeights: s.openWeights,
    providers: s.providers,
    programmingRank: s.programmingRank,
    metricas: s.metricBreakdown.map((m) => ({
      metric: m.metric,
      etiqueta: METRIC_CONFIG[m.metric].label,
      valor: Math.round(m.value * 1000) / 10,
      peso: Math.round(m.weight * 100) / 100,
      // Lo que hace falta para poder comprobar la nota a mano: dónde cae este
      // resultado en la escala, contra qué extremos se reescaló y cuánto se le
      // descuenta a este benchmark por puntuar más alto o más bajo que los otros.
      normalizado: Math.round(m.normalized * 1000) / 10,
      desnivel: Math.round(m.desnivel * 1000) / 10,
      minimo: Math.round(m.min * 1000) / 10,
      maximo: Math.round(m.max * 1000) / 10,
    })),
  };
}
