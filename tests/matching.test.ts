import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as modelsDev } from "../convex/sources/modelsDev";
import { parse as cursorBench } from "../convex/sources/cursorBench";
import { parse as deepSwe } from "../convex/sources/deepSwe";
import { parse as terminalBench } from "../convex/sources/terminalBench";
import { buildIndex, resolveModel } from "../convex/matching/resolve";
import { splitEffort } from "../convex/matching/normalize";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, "fixtures", f), "utf8");
const index = buildIndex(modelsDev(read("modelsdev.json")));

const coverage = (hints: string[]) => {
  const ok = hints.filter((h) => resolveModel(h, index).ok).length;
  return ok / hints.length;
};

test("las cuatro grafías del mismo modelo caen en la misma ficha", () => {
  // CursorBench, DeepSWE, models.dev y OpenRouter lo escriben distinto.
  for (const grafia of [
    "Fable 5.1",
    "claude-fable-5-1",
    "anthropic/claude-fable-5-1",
    "Claude Fable 5.1",
  ]) {
    const r = resolveModel(grafia, index);
    assert.ok(r.ok, `no resolvió "${grafia}"`);
    assert.equal(r.modelKey, "claude-fable-5-1", `"${grafia}" cayó en ${r.modelKey}`);
  }
});

test("el effort viaja aparte del modelo en las tres grafías que existen", () => {
  assert.deepEqual(splitEffort("Fable 5.1 Extra High"), { base: "Fable 5.1", effort: "xhigh" });
  assert.deepEqual(splitEffort("Claude Opus 4.8-xhigh"), { base: "Claude Opus 4.8", effort: "xhigh" });
  assert.deepEqual(splitEffort("DeepSeek-V4 Pro [high]"), { base: "DeepSeek-V4 Pro", effort: "high" });
});

test("DeepSWE resuelve entero: sus slugs ya son los canónicos", () => {
  const hints = deepSwe(read("deepswe.html")).map((o) => o.modelHint);
  assert.equal(coverage(hints), 1);
});

test("Terminal-Bench resuelve entero", () => {
  const hints = terminalBench(read("terminalbench.html")).map((o) => o.modelHint);
  assert.equal(coverage(hints), 1);
});

test("de CursorBench solo se escapa Composer, que no es un modelo público", () => {
  const obs = cursorBench(read("cursorbench.html"));
  const fallidos = obs
    .map((o) => o.modelHint)
    .filter((h) => !resolveModel(h, index).ok);
  assert.deepEqual([...new Set(fallidos)], ["Composer 2.5"]);
});

test("nunca se resuelve a ciegas: sin certeza devuelve sugerencia, no modelo", () => {
  // "Claude 3 Opus" ya no está en el catálogo de primera mano. Se parece mucho
  // a claude-opus-5, y precisamente por eso no debe resolverse solo.
  const r = resolveModel("Claude 3 Opus", index);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.suggestion, "debería dejar una sugerencia para revisar");
});

test("un nombre que no existe no arrastra a ningún modelo", () => {
  const r = resolveModel("Modelo Inventado 9000", index);
  assert.equal(r.ok, false);
});
