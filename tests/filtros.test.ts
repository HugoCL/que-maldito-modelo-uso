import { test } from "vitest";
import assert from "node:assert/strict";
import {
  aplicarFiltrosDeCatalogo,
  catalogoDeModelos,
  coincideFamilia,
  modelosOcultos,
} from "../convex/scoring/filtros";
import { enlace, excluidosDeIncluidos } from "../components/params-portada";
import type { Scored } from "../convex/scoring/compute";

const gpt = {
  modelName: "GPT-6 Astra",
  modelKey: "gpt-6-astra",
  creator: "OpenAI",
} as const;
const claude = {
  modelName: "Claude Opus 5",
  modelKey: "claude-opus-5",
  creator: "Anthropic",
} as const;
const gemini = {
  modelName: "Gemini 3.8 Flash",
  modelKey: "gemini-3-8-flash",
  creator: "Google",
} as const;
const grok = {
  modelName: "Grok 4.6",
  modelKey: "grok-4-6",
  creator: "xAI",
} as const;
const glm = {
  modelName: "GLM-5.3",
  modelKey: "glm-5-3",
  creator: "Z.ai",
} as const;

test("cada atajo deja entrar a su familia y no a las otras", () => {
  assert.equal(coincideFamilia(gpt, "gpt"), true);
  assert.equal(coincideFamilia(claude, "gpt"), false);
  assert.equal(coincideFamilia(claude, "claude"), true);
  assert.equal(coincideFamilia(gemini, "gemini"), true);
  assert.equal(coincideFamilia(gpt, "gemini"), false);
  assert.equal(coincideFamilia(grok, "grok"), true);
  assert.equal(coincideFamilia(glm, "gpt"), false);
});

test("un id de familia desconocido no recorta nada", () => {
  assert.equal(coincideFamilia(claude, "mistral"), true);
});

test("ocultar un modelo lo saca del cálculo y deja al resto", () => {
  const puntuados = [
    { ...gpt, openWeights: false, cost: 1, providers: [] },
    { ...claude, openWeights: false, cost: 1, providers: [] },
  ] as unknown as Scored[];

  const sinGpt = aplicarFiltrosDeCatalogo(puntuados, { ocultos: ["gpt-6-astra"] });
  assert.deepEqual(
    sinGpt.map((s) => s.modelKey),
    ["claude-opus-5"],
  );
});

test("la URL acepta un modelo o varios, separados por coma", () => {
  assert.deepEqual(modelosOcultos("gpt-6-astra"), ["gpt-6-astra"]);
  assert.deepEqual(modelosOcultos(["gpt-6-astra", "claude-opus-5"]), [
    "gpt-6-astra",
    "claude-opus-5",
  ]);
  assert.deepEqual(modelosOcultos("gpt-6-astra,claude-opus-5"), ["gpt-6-astra", "claude-opus-5"]);
});

test("aplicar pone en ocultos los desmarcados y deja el resto de filtros", () => {
  const catalogo = ["gpt-6-astra", "claude-opus-5", "gemini-3-8-flash"];
  const excluidos = excluidosDeIncluidos(catalogo, ["claude-opus-5", "gemini-3-8-flash"]);
  assert.deepEqual(excluidos, ["gpt-6-astra"]);
  assert.equal(
    enlace({ familia: "gpt", max: "3" }, { ocultos: excluidos.join(",") }),
    "/?max=3&familia=gpt&ocultos=gpt-6-astra",
  );
  assert.equal(
    enlace({ familia: "gpt", ocultos: "gpt-6-astra" }, { ocultos: "" }),
    "/?familia=gpt",
  );
  assert.deepEqual(excluidosDeIncluidos(catalogo, catalogo), []);
});

test("un enlace viejo con sinModelo se reescribe como ocultos", () => {
  assert.equal(
    enlace({ familia: "gpt", sinModelo: "gpt-6-astra" }, { familia: "claude" }),
    "/?familia=claude&ocultos=gpt-6-astra",
  );
});

test("el catálogo junta variantes del mismo modelo", () => {
  const lista = catalogoDeModelos([
    { modelKey: "gpt-6-astra", modelName: "GPT-6 Astra", creator: "OpenAI" },
    { modelKey: "gpt-6-astra", modelName: "GPT-6 Astra", creator: "OpenAI" },
    { modelKey: "claude-opus-5", modelName: "Claude Opus 5", creator: "Anthropic" },
  ]);
  assert.deepEqual(
    lista.map((m) => m.modelKey),
    ["gpt-6-astra", "claude-opus-5"],
  );
});

test("el cálculo aún intersecta familia y open weight si los dos llegan", () => {
  const puntuados = [
    { ...gpt, openWeights: false, cost: 1, providers: [] },
    { ...glm, openWeights: true, cost: 1, providers: [] },
  ] as unknown as Scored[];

  const soloGpt = aplicarFiltrosDeCatalogo(puntuados, { familia: "gpt" });
  assert.deepEqual(
    soloGpt.map((s) => s.modelKey),
    ["gpt-6-astra"],
  );

  const abiertos = aplicarFiltrosDeCatalogo(puntuados, { soloOpenWeights: true });
  assert.deepEqual(
    abiertos.map((s) => s.modelKey),
    ["glm-5-3"],
  );

  const juntos = aplicarFiltrosDeCatalogo(puntuados, {
    familia: "gpt",
    soloOpenWeights: true,
  });
  assert.equal(juntos.length, 0);
});
