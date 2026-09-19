import "server-only";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { METRIC_CONFIG, metricasExcluidas, minimoDeBenchmarks } from "../convex/scoring/config";
import type { Metric } from "../convex/sources/types";
import { construirEscala, escalaPublica, scoreAll } from "../convex/scoring/compute";
import { aplicarFiltrosDeCatalogo, esFamilia } from "../convex/scoring/filtros";
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
 * Una lista de la URL, en forma canónica: sin vacíos, sin repetidos y ordenada.
 * Vacía se va a `undefined`, que es como viaja «sin filtro».
 */
function lista(valores: string[] | undefined, vale: (v: string) => boolean = () => true) {
  const limpia = [...new Set((valores ?? []).filter((v) => v && vale(v)))].sort();
  return limpia.length ? limpia : undefined;
}

/**
 * Los filtros reducidos a su forma canónica, que es la clave con la que Convex
 * guarda el resultado.
 *
 * No es cosmética. Convex cachea cada consulta por sus argumentos exactos, así
 * que `{}`, `{sin: []}` y `{sin: [], minimo: 2}` —los tres «sin filtros», que
 * es lo que pide la inmensa mayoría de las visitas— se cacheaban por separado
 * y cada uno volvía a leer la base. Lo mismo un `ocultos` con los mismos
 * modelos en otro orden, o una familia inventada que el servidor ignora.
 *
 * Todo lo que aquí se tira es algo que el servidor ya trataba como ausente: la
 * respuesta no cambia, solo deja de calcularse dos veces.
 */
function normalizar(filtros: FiltrosDeRecomendacion): FiltrosDeRecomendacion {
  const minimo = minimoDeBenchmarks(filtros.minimo);
  const familia = filtros.familia?.trim();
  const canonico: FiltrosDeRecomendacion = {
    // Solo las fuentes que de verdad apagan una métrica: las demás no hacen nada.
    sin: lista(filtros.sin, (f) => metricasExcluidas([f]).length > 0),
    minimo: minimo === minimoDeBenchmarks(undefined) ? undefined : minimo,
    familia: familia && esFamilia(familia) ? familia : undefined,
    ocultos: lista(filtros.ocultos),
    soloOpenWeights: filtros.soloOpenWeights || undefined,
    presupuestoMax: Number.isFinite(filtros.presupuestoMax)
      ? filtros.presupuestoMax
      : undefined,
  };
  // Ordenadas: `{sin, minimo}` y `{minimo, sin}` son el mismo filtro y tienen
  // que dar el mismo viaje.
  return Object.fromEntries(
    Object.entries(canonico)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

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
  return recomendacionesPorClave(JSON.stringify(normalizar(filtros)));
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
 * Las fuentes apagadas en la misma forma canónica que usa `normalizar`, y su
 * ida y vuelta a cadena.
 *
 * Las tres consultas de abajo comparten esta clave por lo mismo que los
 * filtros: `undefined` y `[]` son el mismo «no he apagado nada» y no pueden
 * costar dos cálculos. Y como `cache` de React compara por identidad, un array
 * recién construido en cada llamada nunca acertaría; una cadena sí.
 */
const claveDeFuentes = (sin?: string[]) =>
  JSON.stringify(lista(sin, (f) => metricasExcluidas([f]).length > 0) ?? null);

const fuentesDeLaClave = (clave: string) => (JSON.parse(clave) as string[] | null) ?? undefined;

/**
 * Todo lo puntuado. Lo usa /metodologia para sacar sus ejemplos de
 * los datos de hoy en vez de dejarlos escritos en el HTML, donde envejecen sin
 * que nadie se entere.
 */
const variantesPorClave = cache((clave: string): Promise<Variante[]> => {
  const sin = fuentesDeLaClave(clave);
  return pedirAConvex(consultas.listaVariantes, { sin }, variantesDeLaSemilla(sin));
});

export function obtenerVariantes(sin?: string[]): Promise<Variante[]> {
  return variantesPorClave(claveDeFuentes(sin));
}

// La piden la barra de filtros, el sello del titular y el pie de la tabla, o
// sea tres veces por página. Es la misma respuesta las tres.
export const obtenerMetodologia = cache(async function obtenerMetodologia(): Promise<Metodologia> {
  const m = await pedirAConvex(consultas.metodologia, {}, METODOLOGIA_SEMILLA);
  // El sesgo es copy de config.ts. Next lo tiene a mano, y así un arreglo de
  // una frase no espera a que Convex acepte un push.
  return {
    ...m,
    metricas: m.metricas.map((metrica) => {
      const local = METRIC_CONFIG[metrica.metric as Metric];
      return local ? { ...metrica, sesgo: local.sesgo } : metrica;
    }),
  };
});

/**
 * Los desniveles y el encogimiento de hoy. El respaldo no es una copia guardada
 * sino el mismo cálculo sobre la instantánea, igual que las recomendaciones:
 * una escala congelada explicaría unas notas que ya no son las que se ven.
 */
const escalaPorClave = cache((clave: string): Promise<EscalaPublica> => {
  // Con `sin`, porque apagar una fuente mueve el centro y los extremos: una
  // ficha que puntúa con una fuente menos y explica la escala de otra estaría
  // enseñando una cuenta que no cierra.
  const sin = fuentesDeLaClave(clave);
  return pedirAConvex(
    consultas.escala,
    { sin },
    escalaPublica(construirEscala(CANDIDATOS_SEMILLA, Date.now(), metricasExcluidas(sin))),
  );
});

export function obtenerEscala(sin?: string[]): Promise<EscalaPublica> {
  return escalaPorClave(claveDeFuentes(sin));
}

// La ficha de un modelo se pide dos veces por visita: una para el <title> y
// los metadatos, otra para la página. Es la misma consulta, y sin esto eran
// dos cálculos del conjunto entero para pintar una sola pantalla.
const modeloPorClave = cache((modelKey: string, clave: string): Promise<FichaDeModelo | null> => {
  const sin = fuentesDeLaClave(clave);
  const semilla = MODELOS_SEMILLA[modelKey];
  const respaldo = semilla
    ? { ...semilla, variantes: variantesDeLaSemilla(sin).filter((v) => v.modelKey === modelKey) }
    : null;
  if (!CONVEX_URL) return Promise.resolve(respaldo);
  return pedirAConvex(consultas.modelo, { modelKey, sin }, respaldo);
});

export function obtenerModelo(modelKey: string, sin?: string[]): Promise<FichaDeModelo | null> {
  return modeloPorClave(modelKey, claveDeFuentes(sin));
}

/** Todo lo puntuado sobre la instantánea, con las mismas funciones del servidor. */
function variantesDeLaSemilla(sin?: string[]): Variante[] {
  const puntuados = scoreAll(CANDIDATOS_SEMILLA, Date.now(), metricasExcluidas(sin));
  const enFrontera = new Set(paretoFrontier(elegibles(puntuados)));
  return puntuados
    .sort((a, b) => b.quality - a.quality)
    .map((s) => ({ ...aTarjeta(s), enFrontera: enFrontera.has(s) }));
}
