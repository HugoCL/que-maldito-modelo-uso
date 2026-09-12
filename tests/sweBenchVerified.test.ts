import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "../convex/sources/sweBenchVerified";

const here = dirname(fileURLToPath(import.meta.url));
const obs = parse(readFileSync(join(here, "fixtures/swebench.json"), "utf8"));

test("elige el tablero Verified y no cualquier otro", () => {
  assert.ok(obs.length > 30, `solo ${obs.length} filas`);
  assert.ok(obs.every((o) => o.metric === "swebench_verified.resolved"));
});

test("colapsa los andamios a un mejor resultado por modelo+effort", () => {
  const keys = obs.map((o) => `${o.modelHint}@${o.effort}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("el líder es el mejor de los andamios que lo corrieron", () => {
  const top = obs.slice().sort((a, b) => b.value - a.value)[0];
  assert.ok(Math.abs(top.value - 0.792) < 1e-9);
  assert.equal(top.modelHint, "Claude 4.5 Opus");
});

test("cada fila trae su fecha, que es lo que permite penalizar lo viejo", () => {
  assert.ok(obs.every((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.measuredAt ?? "")));
});

test("reasoning_effort nulo cae en 'default'", () => {
  assert.ok(obs.some((o) => o.effort === "default"));
  assert.ok(obs.some((o) => o.effort !== "default"));
});
