import "server-only";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { elegirTarjetas, paretoFrontier } from "../convex/scoring/tiers";
import {
  CAPTURADO_EL,
  ELEGIBLES_SEMILLA,
  METODOLOGIA_SEMILLA,
  MODELOS_SEMILLA,
  RECOMENDACIONES_SEMILLA,
} from "./datos-semilla";
import type {
  EstadoDelPipeline,
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
  estado: makeFunctionReference<"query">("ingest/runs:estado"),
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

export type FiltrosDeRecomendacion = {
  /** Techo de USD por tarea. */
  presupuestoMax?: number;
  soloOpenWeights?: boolean;
};

export async function obtenerRecomendaciones(
  perfil: PerfilId = "general",
  filtros: FiltrosDeRecomendacion = {},
): Promise<Recomendaciones> {
  return pedirAConvex(
    consultas.recomendaciones,
    { perfil, ...filtros },
    conFiltrosSobreLaSemilla(perfil, filtros),
  );
}

/**
 * La misma respuesta que daría Convex, calculada aquí sobre la instantánea.
 *
 * Un filtro no recorta una lista ya elegida: se vuelve a elegir sobre el
 * subconjunto, con la misma función `elegirTarjetas` que corre en el servidor.
 * Si no, poner un techo de $3 borraría dos de las tres filas en vez de
 * contestar cuáles son las tres mejores respuestas por debajo de $3, que es
 * justo la pregunta que hace quien pone un techo.
 *
 * Lo que no se recalcula son los límites de normalización: la calidad sale de
 * la instantánea completa, así que un modelo no cambia de número al mover un
 * filtro.
 */
function conFiltrosSobreLaSemilla(
  perfil: PerfilId,
  filtros: FiltrosDeRecomendacion,
): Recomendaciones {
  const base = RECOMENDACIONES_SEMILLA[perfil];
  const universo = ELEGIBLES_SEMILLA[perfil];
  const pool = universo.filter(
    (v) =>
      (filtros.presupuestoMax === undefined ||
        (v.cost ?? Infinity) <= filtros.presupuestoMax) &&
      (!filtros.soloOpenWeights || !!v.openWeights),
  );
  if (pool.length === universo.length) return base;

  const frontera = paretoFrontier(pool).sort((a, b) => b.quality - a.quality);
  return {
    ...base,
    totales: { ...base.totales, elegibles: pool.length, enFrontera: frontera.length },
    tarjetas: elegirTarjetas(pool).map((t) => ({
      tier: t.tier,
      razon: t.razon,
      razonCorta: t.razonCorta,
      ganador: t.ganador,
      alternativas: t.alternativas,
    })),
    frontera,
  };
}

/**
 * La bitácora del pipeline. En modo semilla no hay ninguna: la página de
 * estado lo dice en vez de inventarse una corrida, que en una página que
 * existe justamente para poder no confiar a ciegas sería el peor sitio donde
 * mentir.
 */
export async function obtenerEstado(): Promise<EstadoDelPipeline | null> {
  return pedirAConvex<EstadoDelPipeline | null>(consultas.estado, {}, null);
}

/**
 * Todo lo puntuado del perfil. Lo usa /metodologia para sacar sus ejemplos de
 * los datos de hoy en vez de dejarlos escritos en el HTML, donde envejecen sin
 * que nadie se entere.
 */
export async function obtenerVariantes(perfil: PerfilId = "general"): Promise<Variante[]> {
  return pedirAConvex(consultas.listaVariantes, { perfil }, ELEGIBLES_SEMILLA[perfil]);
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
    ...ELEGIBLES_SEMILLA[perfil],
    ...datos.frontera,
    ...datos.tarjetas.flatMap((t) => [t.ganador, ...t.alternativas]),
  ];
  for (const v of candidatas) {
    if (v.modelKey === modelKey) vistas.set(v.variantKey, v);
  }
  return [...vistas.values()].sort((a, b) => b.quality - a.quality);
}
