/**
 * Comparación de campos del catálogo, sin nada de Convex dentro.
 *
 * Vive aparte de `store.ts` a propósito. `store.ts` importa `../_generated/`,
 * que no se versiona: lo escribe `npx convex dev` y en un clon frío no existe.
 * Cualquier fichero de fuera de `convex/` que importe de ahí arrastra esos
 * imports al typecheck de Next —que sí mira `tests/`— y el build se cae con un
 * TS2307 que en local no se ve, porque en local el directorio sí está. Desde
 * aquí los tests llegan a estas dos funciones sin tocar nada generado.
 */

type Campos = Record<string, unknown>;

/**
 * Igualdad por valor, sin pasar por JSON.
 *
 * `JSON.stringify` no sirve aquí: Convex guarda las claves de un objeto
 * ordenadas y el parser las produce en el orden en que las escribió, así que
 * dos `pricing` idénticos salían como cadenas distintas y todo el catálogo
 * parecía cambiar cada día. Un campo ausente y uno en `undefined` son lo mismo
 * por la misma razón: Convex no guarda los `undefined`.
 */
export function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => igual(x, b[i]))
    );
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const claves = (o: Campos) => Object.keys(o).filter((k) => o[k] !== undefined);
  const ka = claves(a as Campos);
  const kb = claves(b as Campos);
  return ka.length === kb.length && ka.every((k) => igual((a as Campos)[k], (b as Campos)[k]));
}

/**
 * De los campos propuestos, los que de verdad cambian algo.
 *
 * models.dev republica su JSON entero a diario y casi siempre se mueven dos o
 * tres modelos. Sin este filtro cada run reescribía los cientos de filas del
 * catálogo —aunque solo fuera para ponerles un `updatedAt` nuevo—, y cada una
 * de esas escrituras invalida el cache de consultas de Convex, así que la web
 * volvía a calcularlo todo desde cero aunque no hubiera cambiado nada.
 */
export function soloLoQueCambia<T extends object>(previo: T, cambios: Partial<T>): Partial<T> {
  const out: Campos = {};
  for (const [k, val] of Object.entries(cambios)) {
    if (!igual((previo as Campos)[k], val)) out[k] = val;
  }
  return out as Partial<T>;
}
