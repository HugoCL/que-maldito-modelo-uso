import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { METRIC_CONFIG } from "../convex/scoring/config";
import { VERSION, parse, terminalBench } from "../convex/sources/terminalBench";

const here = dirname(fileURLToPath(import.meta.url));
const obs = parse(readFileSync(join(here, "fixtures/terminalbench.html"), "utf8"));

test("desescapa el payload y saca filas", () => {
  assert.ok(obs.length >= 10, `solo ${obs.length} filas`);
});

test("colapsa agentes distintos a un mejor resultado por modelo+effort", () => {
  const keys = obs.map((o) => `${o.modelHint}@${o.effort}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("el líder sale con su intervalo de confianza", () => {
  const top = obs.slice().sort((a, b) => b.value - a.value)[0];
  assert.equal(top.modelHint, "GPT-6 Astra");
  assert.ok(Math.abs(top.value - 0.5818) < 1e-9);
  // 58.18% ± 2.79 pp
  assert.ok(Math.abs(top.ciLo! - 0.5539) < 1e-6);
  assert.ok(Math.abs(top.ciHi! - 0.6097) < 1e-6);
});

test("el costo total de la corrida se reparte entre los intentos", () => {
  const top = obs.slice().sort((a, b) => b.value - a.value)[0];
  // $3267.18 sobre 330 intentos.
  assert.ok(Math.abs(top.costPerTask! - 3267.18 / 330) < 1e-6);
  assert.ok(top.costPerTask! < 50, "un costo por tarea de dos dígitos, no de miles");
});

test("los accuracy vienen en porcentaje y salen como proporción", () => {
  assert.ok(obs.every((o) => o.value > 0 && o.value <= 1));
});

/**
 * El sitio solo sirve la versión vigente, así que el día que suba de versión
 * esta fuente empieza a devolver otros números por la misma dirección. Antes
 * pasó sin que nadie se enterara: la web publicaba cifras de la 4.0 firmadas
 * como 2.0. Que falle es la única forma de que se note.
 */
test("una versión distinta del leaderboard no se ingiere en silencio", () => {
  const fixture = readFileSync(join(here, "fixtures/terminalbench.html"), "utf8");
  const otra = fixture.replaceAll(VERSION, "Terminal-Bench 5.0");

  assert.throws(() => parse(otra), /Terminal-Bench 5\.0/);
  // Y la de siempre sigue pasando, no es que lance con cualquier cosa.
  assert.ok(parse(fixture).length >= 10);
});

test("la atribución y la etiqueta nombran la versión que se lee", () => {
  assert.equal(terminalBench.name, VERSION);
  assert.ok(terminalBench.attribution.startsWith(VERSION));
  assert.equal(METRIC_CONFIG["terminalbench.accuracy"].label, VERSION);
});
