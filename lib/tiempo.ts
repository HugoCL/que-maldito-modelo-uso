/**
 * "hace 6 h".
 *
 * Intl.RelativeTimeFormat diría "hace 6 horas". En una línea monoespaciada
 * pegada a la lista de fuentes, la unidad abreviada es la que cabe sin
 * empujar nada, y es la forma en la que está escrito el diseño.
 */
export function hace(ts: number | null | undefined, ahora: number = Date.now()): string | null {
  if (ts === null || ts === undefined) return null;

  const segundos = Math.max(0, Math.round((ahora - ts) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;

  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 48) return `hace ${horas} h`;

  return `hace ${Math.round(horas / 24)} d`;
}
