import type { Scored } from "./compute";

/**
 * Recortes de catálogo: no cambian cómo se puntúa, solo sobre qué conjunto se
 * vuelven a elegir las tres respuestas. El techo de costo no vive aquí: ese
 * se aplica después y en el gráfico se vela, no se borra.
 */

export const IDS_FAMILIA = ["gpt", "claude", "gemini", "grok"] as const;
export type IdFamilia = (typeof IDS_FAMILIA)[number];

const ORDEN_CREADOR = ["OpenAI", "Anthropic", "Google", "xAI"];

export function esFamilia(id: string): id is IdFamilia {
  return (IDS_FAMILIA as readonly string[]).includes(id);
}

export type ModeloEnLista = { modelKey: string; name: string; creator: string };

/** Modelos que el visitante marcó como que no puede usar. */
export function modelosOcultos(raw?: string | string[]): string[] {
  const partes = Array.isArray(raw) ? raw : raw ? raw.split(",") : [];
  return [...new Set(partes.filter(Boolean))];
}

/** Una fila por modelo, no por variante: el effort no se oculta por separado. */
export function catalogoDeModelos(
  variantes: Array<{ modelKey: string; modelName: string; creator: string }>,
): ModeloEnLista[] {
  const porClave = new Map<string, ModeloEnLista>();
  for (const v of variantes) {
    if (!porClave.has(v.modelKey)) {
      porClave.set(v.modelKey, { modelKey: v.modelKey, name: v.modelName, creator: v.creator });
    }
  }
  return [...porClave.values()].sort((a, b) => {
    const creador = cmpCreador(a.creator, b.creator);
    return creador !== 0 ? creador : a.name.localeCompare(b.name, "es");
  });
}

function cmpCreador(a: string, b: string): number {
  const ia = ORDEN_CREADOR.indexOf(a);
  const ib = ORDEN_CREADOR.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.localeCompare(b, "es");
}

export type FiltrosDeCatalogo = {
  proveedores?: string[];
  soloOpenWeights?: boolean;
  presupuestoMax?: number;
  familia?: string;
  /** Modelos a sacar del cálculo, por `modelKey`. */
  ocultos?: string[];
};

export function coincideFamilia(
  s: { modelName: string; creator: string },
  id: string,
): boolean {
  if (!esFamilia(id)) return true;
  switch (id) {
    case "gpt":
      return /gpt/i.test(s.modelName) || s.creator === "OpenAI";
    case "claude":
      return /claude/i.test(s.modelName) || s.creator === "Anthropic";
    case "gemini":
      return /gemini/i.test(s.modelName) || s.creator === "Google";
    case "grok":
      return /grok/i.test(s.modelName) || s.creator === "xAI";
    default: {
      const _nunca: never = id;
      return _nunca;
    }
  }
}

export function aplicarFiltrosDeCatalogo(puntuados: Scored[], args: FiltrosDeCatalogo): Scored[] {
  const ocultos = new Set(args.ocultos ?? []);
  return puntuados.filter((s) => {
    if (args.soloOpenWeights && !s.openWeights) return false;
    if (args.presupuestoMax !== undefined && (s.cost ?? Infinity) > args.presupuestoMax) {
      return false;
    }
    if (args.proveedores?.length && !args.proveedores.some((p) => s.providers.includes(p))) {
      return false;
    }
    if (args.familia && !coincideFamilia(s, args.familia)) return false;
    if (ocultos.has(s.modelKey)) return false;
    return true;
  });
}
