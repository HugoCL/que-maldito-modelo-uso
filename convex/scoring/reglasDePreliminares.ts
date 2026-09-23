/**
 * Lo que tiene que cumplir un preliminar para entrar, sin nada de Convex
 * dentro para que los tests lleguen aquí (ver `ingest/comparar.ts`).
 *
 * Devuelve el motivo en una frase que se enseña tal cual en el formulario, o
 * `null` si vale.
 */
export function validarPreliminar(p: {
  modelo: string;
  fuenteUrl?: string;
  measuredAt?: string;
  valores: Array<{ metric: string; value: number }>;
}): string | null {
  if (!p.modelo.trim()) return "Falta el modelo.";
  if (p.valores.length === 0) return "Falta al menos un resultado.";
  if (new Set(p.valores.map((x) => x.metric)).size !== p.valores.length) {
    return "Hay un benchmark repetido.";
  }
  // En 0..1, como las observaciones. Un 85 que llegue sin dividir entre cien
  // sería el mejor modelo de la historia por ochenta y cinco veces.
  if (p.valores.some((x) => !Number.isFinite(x.value) || x.value < 0 || x.value > 1)) {
    return "Los resultados van de 0 a 100 %.";
  }
  if (p.fuenteUrl && !/^https?:\/\/\S+$/i.test(p.fuenteUrl)) {
    return "La fuente tiene que ser un enlace http(s).";
  }
  if (p.measuredAt && !/^\d{4}-\d{2}-\d{2}$/.test(p.measuredAt)) {
    return "La fecha va como AAAA-MM-DD.";
  }
  return null;
}
