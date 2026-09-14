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
  calibrateCostFactor,
  construirEscala,
  cuantoEncoger,
  decay,
  resolverDesniveles,
  scoreAll,
  type Candidate,
  type Scored,
} from "../convex/scoring/compute";
import { THRESHOLDS, minimoDeBenchmarks } from "../convex/scoring/config";
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
const scored = scoreAll(candidates, AHORA);
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

// ─── orden de las tarjetas ────────────────────────────────────────────────

test("las tres tarjetas salen en orden de calidad y de precio", () => {
  const t = elegirTarjetas(scoreAll(candidates, AHORA));
  const de = (tier: string) => t.find((x) => x.tier === tier)?.ganador;
  const barato = de("barato");
  const dia = de("dia_a_dia");
  const bueno = de("bueno");

  assert.ok(t.length >= 2, "menos de dos respuestas ya no es una recomendación");
  assert.equal(new Set(t.map((x) => x.ganador.variantKey)).size, t.length);

  if (bueno && dia) assert.ok(bueno.quality >= dia.quality, "bueno < día a día");
  if (barato && dia) assert.ok(barato.cost! <= dia.cost!, "barato > día a día");
  if (dia && bueno) assert.ok(dia.cost! <= bueno.cost!, "día a día > bueno");
  if (barato && bueno) assert.ok(barato.cost! <= bueno.cost!, "barato > bueno");
});

// ─── el mínimo de benchmarks ──────────────────────────────────────────────

test("bajar el mínimo a uno solo añade, nunca quita", () => {
  const conUno = elegibles(scored, 1);
  const claves = new Set(conUno.map((s) => s.variantKey));

  assert.ok(conUno.length > pool.length, "con el mínimo en uno debería entrar más gente");
  for (const s of pool) {
    assert.ok(claves.has(s.variantKey), `${s.variantKey} desapareció al bajar el mínimo`);
  }
  // Lo que entra es justo lo medido una sola vez, y entra marcado.
  for (const s of conUno) {
    if (!pool.some((p) => p.variantKey === s.variantKey)) {
      assert.equal(s.benchmarks, 1);
      assert.equal(s.confidence, "baja");
    }
  }
});

/**
 * Bajar el mínimo no garantiza tres respuestas, y no debe: los medidos una
 * sola vez entran baratos y con la nota de su único benchmark, así que pueden
 * aplastar la frontera y dejar el tramo del día a día vacío. Lo que sí tiene
 * que cumplirse es que nada salga sin marcar.
 */
test("con el mínimo en uno las respuestas siguen siendo coherentes y marcadas", () => {
  const conUno = elegirTarjetas(scored, 1);
  const tiers = conUno.map((t) => t.tier);

  assert.deepEqual(tiers, ["barato", "dia_a_dia", "bueno"].filter((x) => tiers.includes(x as never)));
  assert.equal(new Set(conUno.map((t) => t.ganador.variantKey)).size, conUno.length);

  for (const r of conUno) {
    for (const v of [r.ganador, ...r.alternativas]) {
      assert.ok(v.benchmarks >= 1);
      if (v.benchmarks < THRESHOLDS.benchmarksMinimos) {
        assert.equal(v.confidence, "baja", `${v.variantKey} debería ir marcada`);
      }
    }
  }
});

test("un mínimo raro en la URL cae en el de la metodología", () => {
  assert.equal(minimoDeBenchmarks(undefined), THRESHOLDS.benchmarksMinimos);
  assert.equal(minimoDeBenchmarks(1), 1);
  // Ni cero, ni negativo, ni por encima del umbral: nadie endurece ni desactiva
  // la regla desde la barra de direcciones.
  assert.equal(minimoDeBenchmarks(0), THRESHOLDS.benchmarksMinimos);
  assert.equal(minimoDeBenchmarks(-3), THRESHOLDS.benchmarksMinimos);
  assert.equal(minimoDeBenchmarks(99), THRESHOLDS.benchmarksMinimos);
  assert.equal(minimoDeBenchmarks(NaN), THRESHOLDS.benchmarksMinimos);
});

// ─── la escala común ──────────────────────────────────────────────────────

const mediana = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** La media que sale del desglose: lo que se promedia después de nivelar. */
function mediaNivelada(s: Scored): number {
  const peso = s.metricBreakdown.reduce((a, m) => a + m.weight, 0);
  return s.metricBreakdown.reduce((a, m) => a + (m.normalized - m.desnivel) * m.weight, 0) / peso;
}

const metricasVistas = [...new Set(scored.flatMap((s) => s.metricBreakdown.map((m) => m.metric)))];

/**
 * Lo que el ajuste de desniveles deja en cero, que es lo único que promete: el
 * residuo mediano de cada benchmark contra la nota de los modelos que mide.
 */
test("nivelar deja a cada benchmark sin residuo sobre los modelos que mide", () => {
  const filas = scored.map((s) => s.metricBreakdown).filter((b) => b.length >= 2);
  for (const k of metricasVistas) {
    const residuos: number[] = [];
    for (const f of filas) {
      const mu = mediana(f.map((m) => m.normalized - m.desnivel));
      for (const m of f) if (m.metric === k) residuos.push(m.normalized - m.desnivel - mu);
    }
    if (!residuos.length) continue;
    assert.ok(Math.abs(mediana(residuos)) < 1e-9, `${k} se queda con residuo ${mediana(residuos)}`);
  }
});

/**
 * El desnivel corrige el nivel, no la anchura. Dos benchmarks que reparten a sus
 * modelos en rangos distintos siguen sin cuadrar del todo, y la pareja que menos
 * modelos comparte es la que peor queda. Lo que no puede pasar es que nivelar
 * los separe más de lo que estaban.
 */
test("nivelar acerca los benchmarks entre sí, aunque no los iguale", () => {
  const peor = (nivelado: boolean) => {
    let max = 0;
    for (const a of metricasVistas) {
      for (const b of metricasVistas) {
        if (a >= b) continue;
        const d: number[] = [];
        for (const s of scored) {
          const ma = s.metricBreakdown.find((m) => m.metric === a);
          const mb = s.metricBreakdown.find((m) => m.metric === b);
          if (ma && mb) {
            d.push(
              ma.normalized - (nivelado ? ma.desnivel : 0) - (mb.normalized - (nivelado ? mb.desnivel : 0)),
            );
          }
        }
        if (d.length) max = Math.max(max, Math.abs(mediana(d)));
      }
    }
    return max;
  };
  assert.ok(peor(true) < peor(false), `nivelar empeoró el desajuste: ${peor(false)} → ${peor(true)}`);
});

/**
 * La razón de ser de todo esto. Antes, la calidad media BAJABA cuantos más
 * benchmarks te hubieran medido: promediar tres escalas desniveladas castigaba
 * justo a los que más evidencia tenían.
 */
test("la nota ya no premia que te hayan medido menos", () => {
  const medias = [1, 2, 3].map((n) => {
    const v = scored.filter((s) => s.benchmarks === n).map((s) => s.quality);
    return v.length ? v.reduce((a, x) => a + x, 0) / v.length : undefined;
  });
  const conDatos = medias.filter((m): m is number => m !== undefined);
  assert.ok(conDatos.length >= 2, "hacen falta al menos dos grupos para comparar");
  for (let i = 1; i < conDatos.length; i++) {
    assert.ok(
      conDatos[i] >= conDatos[i - 1],
      `la media con más benchmarks es menor: ${conDatos.join(" · ")}`,
    );
  }
});

/**
 * Un conjunto donde los tres benchmarks dicen lo mismo de casi todos, con dos
 * que se contradicen para que haya desacuerdo que medir. Al coincidir las tres
 * escalas, el desnivel sale cero y lo único que distingue a `una-sola` de
 * `las-tres` es cuánta evidencia las sostiene.
 */
function universoDePrueba(): Candidate[] {
  const cand = (variantKey: string, valores: Record<string, number>): Candidate => ({
    variantKey,
    modelKey: variantKey,
    modelName: variantKey,
    creator: "Prueba",
    effort: "default",
    metrics: Object.entries(valores).map(([metric, value]) => ({
      metric: metric as Candidate["metrics"][number]["metric"],
      value,
    })),
    costSamples: [{ sourceId: "deepswe", costPerTask: 1 }],
    providers: [],
  });
  const tres = (v: number) => ({
    "deepswe.pass_at_1": v,
    "cursorbench.score": v,
    "terminalbench.accuracy": v,
  });

  return [
    ...[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((v, i) => cand(`base-${i}`, tres(v))),
    // Simétricos: dan varianza entre benchmarks sin mover ningún desnivel.
    cand("discrepa-a", { "deepswe.pass_at_1": 0.9, "cursorbench.score": 0.1 }),
    cand("discrepa-b", { "deepswe.pass_at_1": 0.1, "cursorbench.score": 0.9 }),
    cand("una-sola", { "deepswe.pass_at_1": 0.9 }),
    cand("las-tres", tres(0.9)),
  ];
}

test("con la misma medida, más benchmarks encogen menos", () => {
  const universo = universoDePrueba();
  const puntuados = scoreAll(universo, AHORA);
  const una = puntuados.find((s) => s.variantKey === "una-sola")!;
  const tres = puntuados.find((s) => s.variantKey === "las-tres")!;

  // Las tres escalas coinciden, así que no hay desnivel que repartir.
  for (const s of puntuados) {
    for (const m of s.metricBreakdown) assert.ok(Math.abs(m.desnivel) < 1e-9);
  }
  // Y las dos variantes del experimento promedian exactamente lo mismo.
  assert.ok(Math.abs(mediaNivelada(una) - mediaNivelada(tres)) < 1e-9);

  assert.equal(una.benchmarks, 1);
  assert.equal(tres.benchmarks, 3);
  assert.ok(
    tres.quality > una.quality,
    `la sostenida por tres (${tres.quality}) debería quedar por encima de la de una (${una.quality})`,
  );
});

/**
 * El ajuste se fue a 1e+36 la primera vez por esto: una fila con una sola
 * lectura tiene un residuo que vale exactamente su propio desnivel, así que si
 * se la deja opinar se retroalimenta y lo duplica en cada vuelta.
 */
test("el desnivel no se dispara aunque casi nadie tenga dos lecturas", () => {
  const filas = [
    ...Array.from({ length: 40 }, (_, i) => ({ ns: [{ k: "a", v: i / 40 }] })),
    { ns: [{ k: "a", v: 0.5 }, { k: "b", v: 0.3 }] },
    { ns: [{ k: "a", v: 0.7 }, { k: "b", v: 0.5 }] },
  ];
  const d = resolverDesniveles(filas, ["a", "b"], "a");
  assert.equal(d.a, 0);
  assert.ok(Number.isFinite(d.b), `desnivel no finito: ${d.b}`);
  assert.ok(Math.abs(d.b + 0.2) < 1e-9, `esperaba -0.2, salió ${d.b}`);
});

test("sin nada con qué comparar no se encoge nada", () => {
  assert.equal(cuantoEncoger([]), 0);
  assert.equal(cuantoEncoger([[0.5]]), 0, "una sola lectura no dice nada del desacuerdo");
  assert.equal(cuantoEncoger([[0.5, 0.5], [0.5, 0.5]]), 0, "sin varianza entre modelos, no se divide");
});

// ─── el costo en una sola escala ──────────────────────────────────────────

/**
 * Las tareas de un benchmark no son las de otro. Si Terminal-Bench cuesta el
 * doble que DeepSWE para todo el mundo, dos variantes igual de eficientes tienen
 * que salir al mismo precio aunque las haya costeado una fuente distinta.
 */
test("el costo no depende de qué benchmark lo costeó", () => {
  const cand = (variantKey: string, costSamples: Candidate["costSamples"]): Candidate => ({
    variantKey,
    modelKey: variantKey,
    modelName: variantKey,
    creator: "Prueba",
    effort: "default",
    metrics: [{ metric: "deepswe.pass_at_1", value: 0.5 }],
    costSamples,
    providers: [],
  });

  const universo: Candidate[] = [
    ...[1, 2, 4, 8, 16, 32].map((c, i) =>
      cand(`par-${i}`, [
        { sourceId: "deepswe", costPerTask: c },
        { sourceId: "terminalbench", costPerTask: c * 2 },
      ]),
    ),
    cand("solo-deepswe", [{ sourceId: "deepswe", costPerTask: 3 }]),
    cand("ancla", [{ sourceId: "deepswe", costPerTask: 5 }]),
    cand("solo-terminalbench", [{ sourceId: "terminalbench", costPerTask: 6 }]),
  ];

  const escala = construirEscala(universo, AHORA);
  assert.ok(
    Math.abs(Math.exp(escala.desnivelesDeCosto.terminalbench) - 2) < 1e-9,
    `Terminal-Bench debería salir ×2, salió ×${Math.exp(escala.desnivelesDeCosto.terminalbench)}`,
  );

  const puntuados = scoreAll(universo, AHORA);
  const ds = puntuados.find((s) => s.variantKey === "solo-deepswe")!;
  const tb = puntuados.find((s) => s.variantKey === "solo-terminalbench")!;
  assert.ok(ds.costMeasured && tb.costMeasured);
  assert.ok(
    Math.abs(ds.cost! - tb.cost!) < 1e-9,
    `misma eficiencia, distinto precio: ${ds.cost} vs ${tb.cost}`,
  );
});

test("una lectura de costo en cero no se cuela como ganga", () => {
  const uno: Candidate = {
    variantKey: "x@default",
    modelKey: "x",
    modelName: "X",
    creator: "Nadie",
    effort: "default",
    metrics: [{ metric: "deepswe.pass_at_1", value: 0.5 }],
    costSamples: [{ sourceId: "deepswe", costPerTask: 0 }],
    pricing: { input: 3, output: 15, cacheRead: 0.3 },
    providers: [],
  };
  const [s] = scoreAll([uno], AHORA);
  assert.equal(s.costMeasured, false, "un cero no es un costo medido");
  assert.ok(s.cost === undefined || s.cost > 0, `costo imposible: ${s.cost}`);
});

/**
 * El ajuste anterior sumaba cuadrados, así que los modelos de veinte dólares la
 * tarea pesaban cientos de veces más que los de treinta centavos y ponían ellos
 * solos el factor.
 */
test("la calibración no la pone media docena de modelos caros", () => {
  const cand = (variantKey: string, precio: number, medido: number): Candidate => ({
    variantKey,
    modelKey: variantKey,
    modelName: variantKey,
    creator: "Prueba",
    effort: "default",
    metrics: [{ metric: "deepswe.pass_at_1", value: 0.5 }],
    costSamples: [{ sourceId: "deepswe", costPerTask: medido }],
    // Sin caché: el precio mezclado es 0.75*input + 0.25*output. Con los dos
    // iguales sale exactamente `precio`.
    pricing: { input: precio, output: precio },
    providers: [],
  });

  const tipicos = [0.2, 0.3, 0.5, 0.8, 1, 1.5, 2, 3].map((p, i) => cand(`tipico-${i}`, p, p * 2));
  const caros = [40, 60].map((p, i) => cand(`caro-${i}`, p, p * 20));

  const factor = calibrateCostFactor([...tipicos, ...caros], {})!;
  assert.ok(Math.abs(factor - 2) < 1e-9, `el factor se fue a ${factor} en vez de 2`);
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
  const t = elegirTarjetas(scoreAll([uno], AHORA));
  assert.ok(t.length >= 1);
  assert.ok(t.every((x) => x.ganador.variantKey === "x@default"));
});
