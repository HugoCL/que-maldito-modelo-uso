/**
 * Los filtros viven en la URL. Este es el único sitio que arma el query
 * string, para que la barra, la lista de modelos y un enlace copiado
 * hablen el mismo idioma.
 *
 * `ocultos` guarda los que se sacan, no los que se quedan: un enlace
 * compartido lista tres que no puedes usar, no treinta que sí.
 */

export type ParamsPortada = {
  max?: string;
  abiertos?: string;
  sin?: string;
  minimo?: string;
  familia?: string;
  /** Uno o varios `modelKey`, separados por comas. */
  ocultos?: string | string[];
  /** Enlaces viejos; `enlace()` ya no lo escribe. */
  sinModelo?: string | string[];
};

/** Solo estos viajan en la URL; lo que venga de más se cae en el primer clic. */
export const PARAMETROS = ["max", "abiertos", "sin", "minimo", "familia", "ocultos"] as const;

export function valorDeParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.filter(Boolean).join(",");
  return v ?? "";
}

export function enlace(params: ParamsPortada, cambios: ParamsPortada): string {
  const puestos = { ...params, ...cambios };
  if (cambios.ocultos === undefined && !puestos.ocultos && puestos.sinModelo) {
    puestos.ocultos = puestos.sinModelo;
  }
  const busqueda = new URLSearchParams();
  for (const clave of PARAMETROS) {
    const valor = valorDeParam(puestos[clave]);
    if (valor) busqueda.set(clave, valor);
  }
  const qs = busqueda.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * Lo que va en `ocultos`: las claves del catálogo que no quedaron
 * incluidas. El checkbox dice "entra"; la URL sigue diciendo "fuera".
 */
export function excluidosDeIncluidos(
  catalogo: readonly string[],
  incluidos: Iterable<string>,
): string[] {
  const set = new Set(incluidos);
  return catalogo.filter((k) => !set.has(k));
}
