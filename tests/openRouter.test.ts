import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse, parseProgramming } from "../convex/sources/openRouter";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, "fixtures", f), "utf8");
const entries = parse(read("openrouter.json"));
const ranked = parseProgramming(read("openrouter-programming.json"));

test("descarta los alias '-latest', que no son modelos", () => {
  assert.ok(entries.length > 50);
  assert.ok(entries.every((e) => !e.modelKey.startsWith("~")));
});

test("los precios pasan de USD/token a USD/millón", () => {
  const withPrice = entries.filter((e) => e.pricing?.input);
  assert.ok(withPrice.length > 20);
  // Nada razonable cuesta menos de un centavo ni más de mil por millón.
  assert.ok(withPrice.every((e) => e.pricing!.input! > 0.001 && e.pricing!.input! < 1000));
});

test("el id 'vendor/modelo' se parte en creador y clave", () => {
  const m = entries.find((e) => e.modelKey === "claude-fable-5-1");
  assert.ok(m, "falta claude-fable-5-1");
  assert.equal(m.creatorSlug, "anthropic");
  assert.ok(m.providers!.includes("openrouter"));
});

test("el ranking de programación llega numerado desde 1", () => {
  assert.ok(ranked.length >= 10);
  assert.equal(ranked[0].programmingRank, 1);
  assert.deepEqual(
    ranked.map((r) => r.programmingRank),
    ranked.map((_, i) => i + 1),
  );
});

test("el ranking solo aporta la posición, no pisa precios", () => {
  assert.ok(ranked.every((r) => r.pricing === undefined));
});
