/**
 * Las dos decisiones de `refresco.ts`, sin nada de Convex dentro, para que los
 * tests lleguen a ellas sin arrastrar `../_generated/` (ver `comparar.ts`).
 */

/**
 * Un token más corto que esto no protege nada: la ruta es pública y lo único
 * que la separa de cualquiera es este secreto. Con uno corto, mejor apagada.
 */
export const LARGO_MINIMO_DEL_TOKEN = 24;

/**
 * Un run que empezó hace más de esto y no terminó no sigue en marcha: se cayó.
 * Una acción de Convex no pasa de diez minutos, así que quince dejan margen sin
 * bloquear el botón para siempre por un run que murió a medias.
 */
export const RUN_COLGADO_TRAS_MS = 15 * 60 * 1000;

/**
 * Compara el token recibido con el configurado sin cortar en la primera letra
 * distinta, para que el tiempo de respuesta no vaya chivando cuántas acertó.
 * El largo sí se filtra, que es público de todos modos: está arriba.
 */
export function tokenValido(recibido: string, esperado: string | undefined): boolean {
  if (!esperado || esperado.length < LARGO_MINIMO_DEL_TOKEN) return false;
  if (recibido.length !== esperado.length) return false;
  let diferencia = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferencia |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferencia === 0;
}

/** Si la última fila de la bitácora es un run que sigue corriendo. */
export function runEnCurso(
  ultima: { startedAt: number; finishedAt?: number } | null,
  ahora: number,
): boolean {
  if (!ultima || ultima.finishedAt !== undefined) return false;
  return ahora - ultima.startedAt < RUN_COLGADO_TRAS_MS;
}
