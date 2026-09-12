import type { BenchmarkSource, CatalogSource, Source } from "./types";
import { modelsDev } from "./modelsDev";
import { openRouter, openRouterProgramming } from "./openRouter";
import { cursorBench } from "./cursorBench";
import { deepSwe } from "./deepSwe";
import { terminalBench } from "./terminalBench";
import { sweRebench } from "./sweRebench";
import { sweBenchVerified } from "./sweBenchVerified";
import { artificialAnalysis } from "./artificialAnalysis";

/**
 * Todas las fuentes del pipeline. Añadir una es un archivo nuevo y una línea
 * aquí.
 *
 * El orden importa en el catálogo: la primera fuente que describe un modelo se
 * queda con su identidad y su precio, y las siguientes solo rellenan huecos.
 * models.dev va primero porque trae al fabricante; OpenRouter después, porque
 * lo suyo es la disponibilidad.
 */
export const SOURCES: Source[] = [
  modelsDev,
  openRouter,
  openRouterProgramming,
  deepSwe,
  cursorBench,
  terminalBench,
  sweRebench,
  sweBenchVerified,
  artificialAnalysis,
];

export const ENABLED_SOURCES = () => SOURCES.filter((s) => s.enabled);

export const catalogSources = (): CatalogSource[] =>
  SOURCES.filter((s): s is CatalogSource => s.kind === "catalogo" && s.enabled);

export const benchmarkSources = (): BenchmarkSource[] =>
  SOURCES.filter((s): s is BenchmarkSource => s.kind === "benchmark" && s.enabled);

export const sourceById = (id: string): Source | undefined =>
  SOURCES.find((s) => s.id === id);

/**
 * Nos identificamos en cada petición. Varias de estas páginas no publican una
 * API: lo mínimo es decir quiénes somos y dejar a dónde escribir.
 */
export const USER_AGENT =
  "QueMalditoModeloUso/0.1 (+https://quemalditomodelouso.com; ingesta diaria, atribución con enlace)";
