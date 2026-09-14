/**
 * Genera lib/datos-semilla.ts a partir de los fixtures.
 *
 * Sirve para que la web se pueda ver y trabajar antes de tener un despliegue
 * de Convex conectado, y para que los componentes se puedan revisar sin
 * depender de la red. En producción manda Convex: estos datos solo se usan
 * cuando NEXT_PUBLIC_CONVEX_URL no está definido, y la UI lo dice en pantalla.
 *
 *   npx vite-node scripts/generar-datos-semilla.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parse as modelsDev } from "../convex/sources/modelsDev";
import { parseProgramming } from "../convex/sources/openRouter";
import { parse as cursorBench } from "../convex/sources/cursorBench";
import { parse as deepSwe } from "../convex/sources/deepSwe";
import { parse as terminalBench } from "../convex/sources/terminalBench";
import { buildCandidates } from "../convex/scoring/candidates";
import {
  METRIC_CONFIG,
  THRESHOLDS,
  TOKEN_MIX,
  fuenteDeMetrica,
  pesosIguales,
} from "../convex/scoring/config";
import { SOURCES } from "../convex/sources/registry";
import type { Metric } from "../convex/sources/types";

const read = (f: string) => readFileSync(`tests/fixtures/${f}`, "utf8");

const catalogo = modelsDev(read("modelsdev.json"));
const rank = new Map(
  parseProgramming(read("openrouter-programming.json")).map((r) => [r.modelKey, r.programmingRank]),
);
for (const c of catalogo) c.programmingRank = rank.get(c.modelKey);

const { candidates } = buildCandidates(catalogo, [
  { sourceId: "deepswe", observations: deepSwe(read("deepswe.html")) },
  { sourceId: "cursorbench", observations: cursorBench(read("cursorbench.html")) },
  { sourceId: "terminalbench", observations: terminalBench(read("terminalbench.html")) },
]);

const porModelo = new Map(catalogo.map((c) => [c.modelKey, c]));

const modelos = Object.fromEntries(
  [...new Set(candidates.map((c) => c.modelKey))].map((key) => {
    const m = porModelo.get(key)!;
    return [
      key,
      {
        modelKey: m.modelKey,
        slug: `${m.creatorSlug}/${m.modelKey}`,
        name: m.name,
        creator: m.creator,
        description: m.description,
        releaseDate: m.releaseDate,
        knowledgeCutoff: m.knowledgeCutoff,
        openWeights: m.openWeights,
        contextLimit: m.contextLimit,
        outputLimit: m.outputLimit,
        pricing: m.pricing,
        providers: m.providers ?? [],
        programmingRank: m.programmingRank,
      },
    ];
  }),
);

const metodologia = {
  metricas: Object.entries(METRIC_CONFIG)
    .filter(([, c]) => c.activa)
    .map(([metric, c]) => ({
      metric,
      etiqueta: c.label,
      fuente: fuenteDeMetrica(metric as Metric),
      peso: pesosIguales()[metric as Metric],
      vidaMediaMeses: c.halfLifeMonths,
      sesgo: c.sesgo,
    })),
  umbrales: {
    benchmarksMinimos: THRESHOLDS.benchmarksMinimos,
    benchmarksMinimosSuelo: THRESHOLDS.benchmarksMinimosSuelo,
    pisoCalidadBarato: THRESHOLDS.pisoCalidadBarato,
    pisoCalidadDiaADia: THRESHOLDS.pisoCalidadDiaADia,
    percentilCostoBarato: THRESHOLDS.percentilCostoBarato,
  },
  mezclaDeTokens: TOKEN_MIX,
  fuentes: SOURCES.map((s) => ({
    id: s.id,
    nombre: s.name,
    tipo: s.kind,
    homepage: s.homepage,
    atribucion: s.attribution,
    licencia: s.license,
    activa: s.enabled,
    nota: s.note,
  })),
};

const salida = `// GENERADO POR scripts/generar-datos-semilla.ts. No editar a mano.
//
// Instantánea del pipeline corrido sobre los fixtures de tests/fixtures.
// Se usa solo cuando NEXT_PUBLIC_CONVEX_URL no está definido, para poder ver y
// trabajar la web sin un despliegue conectado. La UI avisa cuando está en este
// modo.
//
// Regenerar:  npx vite-node scripts/generar-datos-semilla.ts

import type { Candidate } from "../convex/scoring/compute";
import type { Metodologia, Modelo } from "./types";

export const CAPTURADO_EL = ${JSON.stringify(new Date().toISOString().slice(0, 10))};

// Los candidatos crudos, no un resultado ya calculado: la web sin Convex corre
// el mismo pipeline sobre ellos que corre el servidor. Guardar el resultado
// obligaba a precomputar una copia por cada combinación de filtros, y cualquier
// filtro nuevo dejaba el modo semilla enseñando otra cosa que producción.
export const CANDIDATOS_SEMILLA: Candidate[] =
  ${JSON.stringify(candidates)};

export const MODELOS_SEMILLA: Record<string, Modelo> = ${JSON.stringify(modelos)};

export const METODOLOGIA_SEMILLA: Metodologia = ${JSON.stringify(metodologia)};
`;

writeFileSync("lib/datos-semilla.ts", salida);
console.log(
  `lib/datos-semilla.ts: ${Object.keys(modelos).length} modelos, ${candidates.length} variantes`,
);
