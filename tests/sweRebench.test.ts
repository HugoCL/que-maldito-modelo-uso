import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "../convex/sources/sweRebench";

const here = dirname(fileURLToPath(import.meta.url));
const obs = parse(readFileSync(join(here, "fixtures/swerebench.html"), "utf8"));

test("saca modelos del payload escapado", () => {
  assert.ok(obs.length > 40, `solo ${obs.length} modelos`);
});

test("descarta los agentes completos, que no son modelos", () => {
  for (const agente of ["Cursor", "Codex", "Claude Code"]) {
    assert.ok(!obs.some((o) => o.sourceKey === agente), `${agente} no debería estar`);
  }
});

test("el effort pegado con guion o entre corchetes se separa bien", () => {
  const guion = obs.find((o) => o.sourceKey === "Claude Opus 4.8-xhigh");
  assert.ok(guion, "falta Claude Opus 4.8-xhigh");
  assert.equal(guion.modelHint, "Claude Opus 4.8");
  assert.equal(guion.effort, "xhigh");

  const corchete = obs.find((o) => o.sourceKey === "DeepSeek-V4 Pro [high]");
  assert.ok(corchete, "falta DeepSeek-V4 Pro [high]");
  assert.equal(corchete.modelHint, "DeepSeek-V4 Pro");
  assert.equal(corchete.effort, "high");
});

test("un nombre con guion que no es effort queda intacto", () => {
  const d = obs.find((o) => o.sourceKey === "DeepSeek-V3-0324");
  assert.ok(d);
  assert.equal(d.modelHint, "DeepSeek-V3-0324");
  assert.equal(d.effort, "default");
});

test("el intervalo sale del error estándar, no inventado", () => {
  const conCI = obs.filter((o) => o.ciLo !== undefined);
  assert.ok(conCI.length > 20);
  assert.ok(conCI.every((o) => o.ciLo! <= o.value && o.value <= o.ciHi!));
});

test("instanceCosts en cero se trata como 'sin medir', no como gratis", () => {
  assert.ok(obs.every((o) => o.costPerTask === undefined || o.costPerTask > 0));
});

test("se toma la ventana más reciente de la serie", () => {
  const fechas = obs.map((o) => o.measuredAt!).sort();
  assert.ok(fechas.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)));
  assert.ok(fechas.at(-1)! >= "2026-01-01", `la más nueva es ${fechas.at(-1)}`);
});
