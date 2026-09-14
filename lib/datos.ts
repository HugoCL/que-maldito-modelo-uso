import "server-only";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { metricasExcluidas, minimoDeBenchmarks } from "../convex/scoring/config";
import { construirEscala, escalaPublica, scoreAll } from "../convex/scoring/compute";
import { aplicarFiltrosDeCatalogo } from "../convex/scoring/filtros";
import { aTarjeta } from "../convex/scoring/presentar";
import { elegibles, paretoFrontier, seleccionarRespuestas } from "../convex/scoring/tiers";
import {
  CANDIDATOS_SEMILLA,
  CAPTURADO_EL,
  METODOLOGIA_SEMILLA,
  MODELOS_SEMILLA,
} from "./datos-semilla";
import type {
  EscalaPublica,
  EstadoDelPipeline,
  FichaDeModelo,
  Metodologia,
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
  escala: makeFunctionReference<"query">("public/queries:escala"),
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
  /** Fuentes apagadas, por identificador (`cursorbench`). */
  sin?: string[];
  /** Benchmarks distintos exigidos para optar a una tarjeta. */
  minimo?: number;
  familia?: string;
  ocultos?: string[];
};

/**
 * Las recomendaciones, una sola vez por petición y juego de filtros.
 *
 * La portada las pide desde dos sitios —el titular, para decir cuál es la
 * respuesta de hoy, y la tabla— y sin esto serían dos viajes a Convex por los
 * mismos datos. `cache` de React compara los argumentos por identidad, así que
 * la clave que se le pasa es una cadena y no el objeto de filtros, que llega
 * recién construido desde cada sitio que llama.
 */
const recomendacionesPorClave = cache((clave: string): Promise<Recomendaciones> => {
  const filtros = JSON.parse(clave) as FiltrosDeRecomendacion;
  return pedirAConvex(consultas.recomendaciones, { ...filtros }, sobreLaSemilla(filtros));
});

export function obtenerRecomendaciones(
  filtros: FiltrosDeRecomendacion = {},
): Promise<Recomendaciones> {
  // Las claves, ordenadas: `{sin, minimo}` y `{minimo, sin}` son el mismo
  // filtro y tienen que dar el mismo viaje.
  const ordenado = Object.fromEntries(
    Object.entries(filtros)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return recomendacionesPorClave(JSON.stringify(ordenado));
}

/**
 * La misma respuesta que daría Convex, calculada aquí sobre la instantánea.
 *
 * No es una copia de la lógica: importa y corre las mismas funciones que el
 * servidor sobre los mismos candidatos crudos. Lo que la instantánea guarda no
 * es un resultado sino la entrada, así que un filtro nuevo funciona en los dos
 * modos sin tocar nada aquí.
 */
function sobreLaSemilla(filtros: FiltrosDeRecomendacion): Recomendaciones {
  const puntuados = scoreAll(CANDIDATOS_SEMILLA, Date.now(), metricasExcluidas(filtros.sin));
  const filtrados = aplicarFiltrosDeCatalogo(puntuados, filtros);

  const minimo = minimoDeBenchmarks(filtros.minimo);
  const pool = elegibles(filtrados, minimo);
  const enFrontera = new Set(paretoFrontier(pool));
  const { tarjetas, sinDiaADia } = seleccionarRespuestas(filtrados, minimo);

  return {
    actualizado: null,
    totales: {
      candidatos: CANDIDATOS_SEMILLA.length,
      elegibles: pool.length,
      enFrontera: enFrontera.size,
      unaFuente: filtrados.filter((s) => s.benchmarks > 0 && s.benchmarks < minimo).length,
    },
    tarjetas: tarjetas.map((t) => ({
      tier: t.tier,
      razon: t.razon,
      razonCorta: t.razonCorta,
      ganador: aTarjeta(t.ganador),
      alternativas: t.alternativas.map(aTarjeta),
      repiteA: t.repiteA,
    })),
    sinDiaADia,
    elegibles: [...pool]
      .sort((a, b) => b.quality - a.quality)
      .map((s) => ({ ...aTarjeta(s), enFrontera: enFrontera.has(s) })),
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
 * Todo lo puntuado. Lo usa /metodologia para sacar sus ejemplos de
 * los datos de hoy en vez de dejarlos escritos en el HTML, donde envejecen sin
 * que nadie se entere.
 */
export async function obtenerVariantes(sin?: string[]): Promise<Variante[]> {
  return pedirAConvex(consultas.listaVariantes, { sin }, variantesDeLaSemilla(sin));
}

export async function obtenerMetodologia(): Promise<Metodologia> {
  return pedirAConvex(consultas.metodologia, {}, METODOLOGIA_SEMILLA);
}

/**
 * Los desniveles y el encogimiento de hoy. El respaldo no es una copia guardada
 * sino el mismo cálculo sobre la instantánea, igual que las recomendaciones:
 * una escala congelada explicaría unas notas que ya no son las que se ven.
 */
export async function obtenerEscala(): Promise<EscalaPublica> {
  return pedirAConvex(
    consultas.escala,
    {},
    escalaPublica(construirEscala(CANDIDATOS_SEMILLA, Date.now())),
  );
}

export async function obtenerModelo(
  modelKey: string,
  sin?: string[],
): Promise<FichaDeModelo | null> {
  const semilla = MODELOS_SEMILLA[modelKey];
  const respaldo = semilla
    ? { ...semilla, variantes: variantesDeLaSemilla(sin).filter((v) => v.modelKey === modelKey) }
    : null;
  if (!CONVEX_URL) return respaldo;
  return pedirAConvex(consultas.modelo, { modelKey, sin }, respaldo);
}

/** Todo lo puntuado sobre la instantánea, con las mismas funciones del servidor. */
function variantesDeLaSemilla(sin?: string[]): Variante[] {
  const puntuados = scoreAll(CANDIDATOS_SEMILLA, Date.now(), metricasExcluidas(sin));
  const enFrontera = new Set(paretoFrontier(elegibles(puntuados)));
  return puntuados
    .sort((a, b) => b.quality - a.quality)
    .map((s) => ({ ...aTarjeta(s), enFrontera: enFrontera.has(s) }));
}
