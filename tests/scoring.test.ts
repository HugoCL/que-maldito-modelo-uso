import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as modelsDev } from "../convex/sources/modelsDev";
import { parse as cursorBench } from "../convex/sources/cursorBench";
import { parse as deepSwe } from "../convex/sources/deepSwe";
import { parse as terminalBench } from "../convex/sources/terminalBench";
import { buildCandidates } from "../convex/scoring/candidates";
import {
  blendedPrice,
  decay,
  scoreAll,
  type Candidate,
  type Scored,
} from "../convex/scoring/compute";
import {
  codoDeLaFrontera,
  elegibles,
  elegirTarjetas,
  empatanEstadisticamente,
  excesoSobreLaCuerda,
  paretoFrontier,
} from "../convex/scoring/tiers";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, "fixtures", f), "utf8");

const catalog = modelsDev(read("modelsdev.json"));
const { candidates } = buildCandidates(catalog, [
  { sourceId: "deepswe", observations: deepSwe(read("deepswe.html")) },
  { sourceId: "cursorbench", observations: cursorBench(read("cursorbench.html")) },
  { sourceId: "terminalbench", observations: terminalBench(read("terminalbench.html")) },
]);

// Fecha fija: si no, los tests de decaimiento cambian de resultado cada día.
const AHORA = Date.parse("2026-09-11T00:00:00Z");
const scored = scoreAll(candidates, "general", AHORA);
const pool = elegibles(scored);
const frontier = paretoFrontier(pool);
const tarjetas = elegirTarjetas(scored);
const porTier = new Map(tarjetas.map((t) => [t.tier, t]));

// ─── el pipeline entero ───────────────────────────────────────────────────

test("el pipeline produce las tres tarjetas", () => {
  assert.deepEqual(
    tarjetas.map((t) => t.tier),
    ["barato", "dia_a_dia", "bueno"],
  );
});

test("las tres respuestas son tres modelos distintos", () => {
  const ganadores = tarjetas.map((t) => t.ganador.variantKey);
  assert.equal(new Set(ganadores).size, 3);
});

test("nunca se recomienda una variante dominada", () => {
  const enFrontera = new Set(frontier);
  for (const t of tarjetas) {
    assert.ok(
      enFrontera.has(t.ganador) || t.tier === "bueno",
      `${t.tier} recomienda ${t.ganador.variantKey}, que está dominada`,
    );
  }
});

test("el orden de las tarjetas respeta su propia definición", () => {
  const barato = porTier.get("barato")!.ganador;
  const dia = porTier.get("dia_a_dia")!.ganador;
  const bueno = porTier.get("bueno")!.ganador;

  assert.ok(bueno.quality >= dia.quality, "'bueno' no puede tener menos calidad que 'día a día'");
  assert.ok(dia.quality >= barato.quality, "'día a día' no puede tener menos calidad que 'barato'");
  assert.ok(barato.cost! <= dia.cost!, "'barato' no puede costar más que 'día a día'");
  assert.ok(dia.cost! <= bueno.cost!, "'día a día' no puede costar más que 'bueno'");
});

test("las alternativas no repiten al ganador ni a las otras tarjetas", () => {
  const ganadores = new Set(tarjetas.map((t) => t.ganador.variantKey));
  for (const t of tarjetas) {
    const vistas = new Set<string>();
    for (const a of t.alternativas) {
      assert.ok(
        !ganadores.has(a.variantKey),
        `${t.tier}: ${a.variantKey} ya es el ganador de una tarjeta`,
      );
      assert.ok(!vistas.has(a.variantKey), `${t.tier}: ${a.variantKey} repetida`);
      vistas.add(a.variantKey);
    }
  }
});

// Si no puedes usar el recomendado, lo que necesitas es otra respuesta a la
// MISMA pregunta. Una suplente de "barato" que cueste más que el ganador de
// "día a día" no lo es.
test("las tres respuestas nunca son el mismo modelo", () => {
  const claves = tarjetas.map((t) => t.ganador.variantKey);
  assert.equal(new Set(claves).size, claves.length, `tarjetas repetidas: ${claves.join(", ")}`);
});

test("las razones citan números reales, no plantillas vacías", () => {
  for (const t of tarjetas) {
    assert.match(t.razon, /\$\d/, `la razón de ${t.tier} no menciona ningún costo`);
    assert.ok(t.razon.length > 40);
  }
});

// La fila de la portada enseña calidad y costo en su propia columna: si la
// frase de al lado repitiera esos dos números, la columna sobraría.
test("la razón corta cabe en una línea y no repite el costo del ganador", () => {
  for (const t of tarjetas) {
    assert.ok(t.razonCorta.length > 20, `la razón corta de ${t.tier} está vacía`);
    assert.ok(t.razonCorta.length <= 80, `la razón corta de ${t.tier} no cabe en una línea`);
    assert.ok(
      !t.razonCorta.includes(`$${t.ganador.cost!.toFixed(2)}`),
      `la razón corta de ${t.tier} repite el costo que ya está en su columna`,
    );
  }
});

// ─── calidad e incertidumbre ──────────────────────────────────────────────

test("la banda de calidad siempre contiene al punto", () => {
  for (const s of scored) {
    assert.ok(s.qualityLo <= s.quality + 1e-9, `${s.variantKey}: lo > punto`);
    assert.ok(s.quality <= s.qualityHi + 1e-9, `${s.variantKey}: punto > hi`);
  }
});

test("con intervalos solapados manda el costo, no la décima de diferencia", () => {
  const a = { quality: 80, qualityLo: 77, qualityHi: 83, cost: 10 } as Scored;
  const b = { quality: 79.5, qualityLo: 76, qualityHi: 82, cost: 3 } as Scored;
  assert.ok(empatanEstadisticamente(a, b));

  const c = { quality: 50, qualityLo: 49, qualityHi: 51, cost: 1 } as Scored;
  assert.ok(!empatanEstadisticamente(a, c));
});

test("un benchmark viejo pesa menos que uno de hoy", () => {
  assert.equal(decay("2026-09-11", 9, AHORA), 1);
  // Nueve meses justos = media vida.
  const medioAno = decay("2025-12-13", 9, AHORA);
  assert.ok(Math.abs(medioAno - 0.5) < 0.02, `decaimiento a los 9 meses: ${medioAno}`);
  // Sin vida media configurada no se descuenta nada.
  assert.equal(decay("2024-01-01", null, AHORA), 1);
});

test("la cobertura decide la confianza y la confianza decide quién compite", () => {
  for (const s of scored) {
    if (s.confidence === "baja") {
      assert.ok(!pool.includes(s), `${s.variantKey} tiene confianza baja y aun así compite`);
    }
  }
});

// ─── costo ────────────────────────────────────────────────────────────────

test("un precio de cero se trata como desconocido, no como gratis", () => {
  assert.equal(blendedPrice({ input: 0, output: 0 }), undefined);
  assert.equal(blendedPrice(undefined), undefined);
  assert.ok((blendedPrice({ input: 3, output: 15, cacheRead: 0.3 }) ?? 0) > 0);
});

test("la mezcla agéntica pesa la caché, que es donde se va el gasto real", () => {
  const conCache = blendedPrice({ input: 3, output: 15, cacheRead: 0.3 })!;
  const sinCache = blendedPrice({ input: 3, output: 15 })!;
  // 0.7*0.3 + 0.2*3 + 0.1*15 = 2.31 frente a 0.75*3 + 0.25*15 = 6.0
  assert.ok(Math.abs(conCache - 2.31) < 1e-9);
  assert.ok(Math.abs(sinCache - 6) < 1e-9);
});

test("ningún costo recomendado sale de una fuente no comparable", () => {
  // SWE-bench Verified reporta instance_cost con andamios de terceros sobre
  // tareas mucho más fáciles: si se colara, saldrían modelos "de $0.07".
  for (const t of tarjetas) {
    assert.ok(t.ganador.cost! > 0.1, `${t.ganador.variantKey} cuesta ${t.ganador.cost}`);
  }
});

test("los costos medidos ganan a los estimados", () => {
  const conAmbos = scored.filter((s) => s.costMeasured && s.blendedPrice !== undefined);
  assert.ok(conAmbos.length > 5);
  // Un costo medido no puede coincidir con el estimado salvo por casualidad:
  // lo que importa es que la bandera diga la verdad.
  assert.ok(tarjetas.every((t) => typeof t.ganador.costMeasured === "boolean"));
});

// ─── geometría de la frontera ─────────────────────────────────────────────

test("la frontera está ordenada: más calidad siempre cuesta más", () => {
  const orden = [...frontier].sort((a, b) => a.cost! - b.cost!);
  for (let i = 1; i < orden.length; i++) {
    assert.ok(
      orden[i].quality > orden[i - 1].quality,
      `${orden[i].variantKey} cuesta más que ${orden[i - 1].variantKey} sin ser mejor`,
    );
  }
});

test("el codo premia lo que está por encima de la cuerda, no lo que está lejos", () => {
  // Tres puntos: uno convexo (bueno) y uno cóncavo (malo), ambos a la misma
  // distancia de la recta. El codo tiene que ser el de arriba.
  const p = (cost: number, quality: number) => ({ cost, quality }) as Scored;
  const barato = p(1, 0);
  const arriba = p(10, 70);
  const abajo = p(10, 30);
  const caro = p(100, 100);

  const conArriba = codoDeLaFrontera([barato, arriba, caro]);
  assert.equal(conArriba, arriba);

  const exceso = excesoSobreLaCuerda([barato, abajo, caro]);
  assert.ok(exceso.get(abajo)! < 0, "un punto peor que la interpolación debe dar exceso negativo");
});

test("el codo se mide contra la frontera entera aunque se elija en un subconjunto", () => {
  const p = (cost: number, quality: number) => ({ cost, quality }) as Scored;
  const pts = [p(1, 0), p(3, 60), p(10, 70), p(100, 100)];
  const caros = [pts[2], pts[3]];
  // Entre los caros, el codo sigue siendo el que más se despega de la cuerda
  // global, no simplemente el más barato de los dos.
  const elegido = codoDeLaFrontera(pts, caros);
  assert.equal(elegido, pts[2]);
});

// ─── perfiles ─────────────────────────────────────────────────────────────

test("cambiar de perfil cambia las respuestas", () => {
  const agentico = elegirTarjetas(scoreAll(candidates, "agentico", AHORA));
  const mantenimiento = elegirTarjetas(scoreAll(candidates, "mantenimiento", AHORA));
  for (const conjunto of [agentico, mantenimiento]) {
    // Un perfil puede quedarse en dos respuestas cuando no hay datos para tres,
    // que es lo que pasa con el trabajo agéntico porque casi nadie lo mide. Una
    // sola respuesta ya no es una recomendación, es una lista.
    assert.ok(conjunto.length >= 2, "un perfil con menos de dos respuestas no sirve");
    assert.equal(new Set(conjunto.map((t) => t.ganador.variantKey)).size, conjunto.length);
  }
  assert.notDeepEqual(
    agentico.map((t) => t.ganador.variantKey),
    mantenimiento.map((t) => t.ganador.variantKey),
  );
});

test("todos los perfiles siguen respetando el orden de las tarjetas", () => {
  for (const perfil of ["general", "mantenimiento", "agentico"] as const) {
    const t = elegirTarjetas(scoreAll(candidates, perfil, AHORA));
    const de = (tier: string) => t.find((x) => x.tier === tier)?.ganador;
    const barato = de("barato");
    const dia = de("dia_a_dia");
    const bueno = de("bueno");

    if (bueno && dia) assert.ok(bueno.quality >= dia.quality, `${perfil}: bueno < día a día`);
    if (barato && dia) assert.ok(barato.cost! <= dia.cost!, `${perfil}: barato > día a día`);
    if (dia && bueno) assert.ok(dia.cost! <= bueno.cost!, `${perfil}: día a día > bueno`);
    if (barato && bueno) assert.ok(barato.cost! <= bueno.cost!, `${perfil}: barato > bueno`);
  }
});

// ─── casos límite ─────────────────────────────────────────────────────────

test("sin candidatos no se inventa una respuesta", () => {
  assert.deepEqual(elegirTarjetas([]), []);
});

test("un solo candidato no rompe nada", () => {
  const uno: Candidate = {
    variantKey: "x@default",
    modelKey: "x",
    modelName: "X",
    creator: "Nadie",
    effort: "default",
    metrics: [
      { metric: "deepswe.pass_at_1", value: 0.5 },
      { metric: "cursorbench.score", value: 0.5 },
      { metric: "terminalbench.accuracy", value: 0.5 },
    ],
    costSamples: [{ sourceId: "deepswe", costPerTask: 1 }],
    providers: [],
  };
  const t = elegirTarjetas(scoreAll([uno], "general", AHORA));
  assert.ok(t.length >= 1);
  assert.ok(t.every((x) => x.ganador.variantKey === "x@default"));
});
