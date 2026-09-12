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
import { parse as sweRebench } from "../convex/sources/sweRebench";
import { parse as sweBenchVerified } from "../convex/sources/sweBenchVerified";
import { buildCandidates } from "../convex/scoring/candidates";
import { scoreAll, type Scored } from "../convex/scoring/compute";
import { elegibles, elegirTarjetas, paretoFrontier } from "../convex/scoring/tiers";
import { METRIC_CONFIG, PERFILES, type PerfilId } from "../convex/scoring/config";
import { SOURCES } from "../convex/sources/registry";

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
  { sourceId: "swerebench", observations: sweRebench(read("swerebench.html")) },
  { sourceId: "swebench-verified", observations: sweBenchVerified(read("swebench.json")) },
]);

const porModelo = new Map(catalogo.map((c) => [c.modelKey, c]));

const aTarjeta = (s: Scored) => ({
  variantKey: s.variantKey,
  modelKey: s.modelKey,
  modelName: s.modelName,
  creator: s.creator,
  effort: s.effort,
  quality: Math.round(s.quality * 10) / 10,
  qualityLo: Math.round(s.qualityLo * 10) / 10,
  qualityHi: Math.round(s.qualityHi * 10) / 10,
  coverage: Math.round(s.coverage * 100) / 100,
  confidence: s.confidence,
  cost: s.cost !== undefined ? Math.round(s.cost * 100) / 100 : undefined,
  costMeasured: s.costMeasured,
  costLo: s.costLo,
  costHi: s.costHi,
  blendedPrice: s.blendedPrice,
  openWeights: s.openWeights,
  providers: s.providers,
  programmingRank: s.programmingRank,
  metricas: s.metricBreakdown.map((m) => ({
    metric: m.metric,
    etiqueta: METRIC_CONFIG[m.metric].label,
    valor: Math.round(m.value * 1000) / 10,
    peso: Math.round(m.weight * 100) / 100,
  })),
});

const perfiles: PerfilId[] = ["general", "mantenimiento", "agentico", "greenfield"];
const porPerfil: Record<string, unknown> = {};

for (const perfil of perfiles) {
  const puntuados = scoreAll(candidates, perfil);
  const pool = elegibles(puntuados);
  const frontera = paretoFrontier(pool);

  porPerfil[perfil] = {
    perfil,
    perfilEtiqueta: PERFILES[perfil].label,
    actualizado: Date.now(),
    totales: {
      candidatos: candidates.length,
      elegibles: pool.length,
      enFrontera: frontera.length,
    },
    tarjetas: elegirTarjetas(puntuados).map((t) => ({
      tier: t.tier,
      razon: t.razon,
      ganador: aTarjeta(t.ganador),
      segundo: t.segundo ? aTarjeta(t.segundo) : null,
    })),
    frontera: frontera.sort((a, b) => b.quality - a.quality).map(aTarjeta),
  };
}

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
    .filter(([, c]) => c.weight > 0)
    .map(([metric, c]) => ({
      metric,
      etiqueta: c.label,
      peso: c.weight,
      vidaMediaMeses: c.halfLifeMonths,
    })),
  perfiles: Object.entries(PERFILES).map(([id, p]) => ({ id, etiqueta: p.label })),
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

const salida = `// GENERADO POR scripts/generar-datos-semilla.ts — no editar a mano.
//
// Instantánea del pipeline corrido sobre los fixtures de tests/fixtures.
// Se usa solo cuando NEXT_PUBLIC_CONVEX_URL no está definido, para poder ver y
// trabajar la web sin un despliegue conectado. La UI avisa cuando está en este
// modo.
//
// Regenerar:  npx vite-node scripts/generar-datos-semilla.ts

import type { Metodologia, Modelo, PerfilId, Recomendaciones } from "./types";

export const CAPTURADO_EL = ${JSON.stringify(new Date().toISOString().slice(0, 10))};

export const RECOMENDACIONES_SEMILLA: Record<PerfilId, Recomendaciones> =
  ${JSON.stringify(porPerfil)};

export const MODELOS_SEMILLA: Record<string, Modelo> = ${JSON.stringify(modelos)};

export const METODOLOGIA_SEMILLA: Metodologia = ${JSON.stringify(metodologia)};
`;

writeFileSync("lib/datos-semilla.ts", salida);
console.log(
  `lib/datos-semilla.ts: ${perfiles.length} perfiles, ${Object.keys(modelos).length} modelos, ` +
    `${candidates.length} variantes`,
);
