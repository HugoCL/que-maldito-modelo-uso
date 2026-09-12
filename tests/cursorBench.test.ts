import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "../convex/sources/cursorBench";

const here = dirname(fileURLToPath(import.meta.url));
const obs = parse(readFileSync(join(here, "fixtures/cursorbench.html"), "utf8"));

test("lee las 43 configuraciones de la tabla, no las 32 del gráfico", () => {
  assert.equal(obs.length, 43);
  assert.equal(new Set(obs.map((o) => o.sourceKey)).size, 43);
});

test("la fila líder sale completa", () => {
  const top = obs.find((o) => o.sourceKey === "Fable 5.1 Max");
  assert.ok(top);
  assert.equal(top.modelHint, "Fable 5.1");
  assert.equal(top.effort, "max");
  assert.ok(Math.abs(top.value - 0.518) < 1e-9);
  assert.equal(top.costPerTask, 17.28);
  assert.equal(top.outputTokens, 117236);
  assert.equal(top.agentSteps, 128);
});

test("'Extra High' se reconoce como xhigh sin mutilar el nombre", () => {
  const x = obs.find((o) => o.sourceKey === "Fable 5.1 Extra High");
  assert.ok(x);
  assert.equal(x.modelHint, "Fable 5.1");
  assert.equal(x.effort, "xhigh");
  assert.equal(x.costPerTask, 13.01);
});

test("un nombre que termina en palabra no-effort se queda entero", () => {
  // "Gemini 3.8 Flash Medium" -> modelo "Gemini 3.8 Flash", effort medium.
  const g = obs.find((o) => o.sourceKey === "Gemini 3.8 Flash Medium");
  assert.ok(g);
  assert.equal(g.modelHint, "Gemini 3.8 Flash");
  assert.equal(g.effort, "medium");
});

test("todas las filas traen costo por tarea medido", () => {
  assert.equal(obs.filter((o) => o.costPerTask === undefined).length, 0);
});

test("los scores son proporciones", () => {
  assert.ok(obs.every((o) => o.value > 0 && o.value <= 1));
});
