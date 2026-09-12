import "server-only";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import {
  CAPTURADO_EL,
  METODOLOGIA_SEMILLA,
  MODELOS_SEMILLA,
  RECOMENDACIONES_SEMILLA,
} from "./datos-semilla";
import type {
  FichaDeModelo,
  Metodologia,
  PerfilId,
  Recomendaciones,
  Variante,
} from "./types";

/**
 * De dónde salen los datos de la web.
 *
 * Con un despliegue de Convex conectado, de Convex. Sin él, de la instantánea
 * en lib/datos-semilla.ts, para que un clon recién bajado se pueda levantar y
 * ver sin configurar nada. La UI avisa cuando está en ese modo: unos datos de
 * hace semanas presentados como frescos serían peor que no tener web.
 *
 * Las referencias a funciones se construyen por nombre en vez de importarlas
 * de convex/_generated a propósito: así el proyecto compila antes de la
 * primera corrida de `npx convex dev`. El precio es que un cambio de nombre en
 * convex/public/queries.ts no lo caza el compilador, y por eso los nombres
 * están todos juntos aquí abajo.
 */

export const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
export const usandoSemilla = !CONVEX_URL;
export const fechaDeLaSemilla = CAPTURADO_EL;

const consultas = {
  recomendaciones: makeFunctionReference<"query">("public/queries:recomendaciones"),
  modelo: makeFunctionReference<"query">("public/queries:modelo"),
  metodologia: makeFunctionReference<"query">("public/queries:metodologia"),
  listaVariantes: makeFunctionReference<"query">("public/queries:listaVariantes"),
};

/** Un fallo de red no debe dejar la página en blanco: se cae a la semilla. */
async function pedirAConvex<T>(
  fn: (typeof consultas)[keyof typeof consultas],
  args: Record<string, unknown>,
  respaldo: T,
): Promise<T> {
  if (!CONVEX_URL) return respaldo;
  try {
    const res = (await fetchQuery(fn, args)) as T | null;
    return res ?? respaldo;
  } catch (err) {
    console.error("Convex no respondió, se usan los datos semilla:", err);
    return respaldo;
  }
}

export async function obtenerRecomendaciones(
  perfil: PerfilId = "general",
): Promise<Recomendaciones> {
  return pedirAConvex(consultas.recomendaciones, { perfil }, RECOMENDACIONES_SEMILLA[perfil]);
}

export async function obtenerMetodologia(): Promise<Metodologia> {
  return pedirAConvex(consultas.metodologia, {}, METODOLOGIA_SEMILLA);
}

export async function obtenerModelo(
  modelKey: string,
  perfil: PerfilId = "general",
): Promise<FichaDeModelo | null> {
  const semilla = MODELOS_SEMILLA[modelKey];
  if (!CONVEX_URL) {
    if (!semilla) return null;
    // En modo semilla las variantes se reconstruyen desde la frontera y el
    // listado del perfil, que es lo que hay guardado.
    const variantes = variantesDeLaSemilla(modelKey, perfil);
    return { ...semilla, variantes };
  }
  const respaldo = semilla ? { ...semilla, variantes: variantesDeLaSemilla(modelKey, perfil) } : null;
  return pedirAConvex(consultas.modelo, { modelKey, perfil }, respaldo);
}

function variantesDeLaSemilla(modelKey: string, perfil: PerfilId): Variante[] {
  const datos = RECOMENDACIONES_SEMILLA[perfil];
  const vistas = new Map<string, Variante>();
  const candidatas = [
    ...datos.frontera,
    ...datos.tarjetas.flatMap((t) => [t.ganador, t.segundo].filter(Boolean) as Variante[]),
  ];
  for (const v of candidatas) {
    if (v.modelKey === modelKey) vistas.set(v.variantKey, v);
  }
  return [...vistas.values()].sort((a, b) => b.quality - a.quality);
}

/** Modelos que la semilla conoce, para generateStaticParams. */
export function clavesDeModeloEnLaSemilla(): string[] {
  return Object.keys(MODELOS_SEMILLA);
}
