import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "../convex/sources/modelsDev";

const here = dirname(fileURLToPath(import.meta.url));
const entries = parse(readFileSync(join(here, "fixtures/modelsdev.json"), "utf8"));
const byKey = new Map(entries.map((e) => [e.modelKey, e]));

test("colapsa los duplicados de gateway a una ficha por modelo", () => {
  assert.ok(entries.length > 200, `solo ${entries.length} modelos`);
  assert.equal(new Set(entries.map((e) => e.modelKey)).size, entries.length);
});

test("la ficha canónica sale del proveedor de primera mano", () => {
  const m = byKey.get("claude-fable-5-1");
  assert.ok(m, "falta claude-fable-5-1");
  assert.equal(m.creator, "Anthropic");
  assert.equal(m.creatorSlug, "anthropic");
  assert.equal(m.openWeights, false);
  assert.ok(m.pricing?.input && m.pricing.input > 0);
  assert.ok(m.pricing?.cacheRead && m.pricing.cacheRead < m.pricing.input!);
});

test("la disponibilidad junta a todos los gateways, no solo al fabricante", () => {
  const m = byKey.get("claude-fable-5-1")!;
  assert.ok(m.providers!.includes("anthropic"));
  assert.ok(m.providers!.length > 1, "debería verse en más de un proveedor");
});

test("los niveles de effort declarados se conservan", () => {
  const m = byKey.get("claude-sonnet-4-6");
  assert.ok(m);
  assert.deepEqual(m.supportedEfforts, ["low", "medium", "high", "max"]);
});

test("hay modelos de pesos abiertos y de pesos cerrados", () => {
  assert.ok(entries.some((e) => e.openWeights === true));
  assert.ok(entries.some((e) => e.openWeights === false));
});

test("los precios están en USD por millón de tokens", () => {
  const m = byKey.get("claude-fable-5-1")!;
  // Un modelo frontera cuesta dólares por millón, no centavos ni miles.
  assert.ok(m.pricing!.input! >= 0.1 && m.pricing!.input! <= 100);
});
