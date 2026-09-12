import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "../convex/sources/deepSwe";

const here = dirname(fileURLToPath(import.meta.url));
const body = readFileSync(join(here, "fixtures/deepswe.html"), "utf8");
const obs = parse(body);

test("extrae las 70 filas modelo x effort", () => {
  assert.equal(obs.length, 70);
  assert.equal(new Set(obs.map((o) => o.sourceKey)).size, 70);
});

test("claude-fable-5 xhigh sale con sus números exactos", () => {
  const f = obs.find((o) => o.modelHint === "claude-fable-5" && o.effort === "xhigh");
  assert.ok(f, "no se encontró claude-fable-5 xhigh");
  assert.equal(f.metric, "deepswe.pass_at_1");
  assert.ok(Math.abs(f.value - 0.6991150442477876) < 1e-12);
  assert.ok(Math.abs(f.ciLo! - 0.6666658684930744) < 1e-12);
  assert.ok(Math.abs(f.ciHi! - 0.7315642200025008) < 1e-12);
  assert.equal(f.nRuns, 4);
  assert.ok(Math.abs(f.costPerTask! - 11.341082999999998) < 1e-9);
});

test("el cost_basis con comas y dos puntos no rompe el scanner", () => {
  // gpt-6-astra trae una nota larga: "...pricing: $12/M uncached input, $15/M..."
  const g = obs.find((o) => o.modelHint === "gpt-6-astra" && o.effort === "xhigh");
  assert.ok(g);
  assert.ok(Math.abs(g.value - 0.7411504424778761) < 1e-12);
  assert.ok(Math.abs(g.costPerTask! - 5.6717151) < 1e-9);
});

test("todas las filas traen costo medido e intervalo de confianza", () => {
  assert.equal(obs.filter((o) => o.costPerTask === undefined).length, 0);
  assert.equal(obs.filter((o) => o.ciLo === undefined).length, 0);
});

test("los efforts quedan normalizados al vocabulario del esquema", () => {
  const efforts = [...new Set(obs.map((o) => o.effort))].sort();
  assert.deepEqual(efforts, ["default", "high", "low", "max", "medium", "xhigh"]);
});

test("reasoning_effort:null cae en 'default', no se descarta la fila", () => {
  // kimi-k2-7-code no expone control de effort: DeepSWE lo reporta como null.
  const k = obs.filter((o) => o.modelHint === "kimi-k2-7-code");
  assert.equal(k.length, 1);
  assert.equal(k[0].effort, "default");
});

test("los pass rates son proporciones, no porcentajes", () => {
  assert.ok(obs.every((o) => o.value > 0 && o.value <= 1));
});
