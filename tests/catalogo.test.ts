import { describe, expect, it } from "vitest";
import { igual, soloLoQueCambia } from "../convex/ingest/store";

/**
 * El filtro de escrituras del catálogo.
 *
 * Es la pieza que decide si una fila de `models` se reescribe o no, así que un
 * fallo aquí no se ve: o se reescribe el catálogo entero cada día —que es lo
 * que costaba I/O— o deja de actualizarse y los precios se quedan congelados
 * sin que nada falle.
 */
describe("igual", () => {
  it("no mira el orden de las claves: Convex las guarda ordenadas y el parser no", () => {
    expect(igual({ input: 10, output: 50 }, { output: 50, input: 10 })).toBe(true);
  });

  it("trata un campo ausente y uno en undefined como lo mismo", () => {
    expect(igual({ input: 1 }, { input: 1, cacheWrite: undefined })).toBe(true);
    expect(igual({ input: 1, cacheWrite: undefined }, { input: 1 })).toBe(true);
  });

  it("distingue un campo de más con valor", () => {
    expect(igual({ input: 1 }, { input: 1, cacheWrite: 0 })).toBe(false);
  });

  it("compara arrays por posición", () => {
    expect(igual(["a", "b"], ["a", "b"])).toBe(true);
    expect(igual(["a", "b"], ["b", "a"])).toBe(false);
    expect(igual(["a"], ["a", "b"])).toBe(false);
  });

  it("no confunde un array con un objeto de índices", () => {
    expect(igual(["a"], { 0: "a" })).toBe(false);
  });

  it("baja a los objetos anidados", () => {
    expect(igual({ p: { input: 1 } }, { p: { input: 1 } })).toBe(true);
    expect(igual({ p: { input: 1 } }, { p: { input: 2 } })).toBe(false);
  });
});

describe("soloLoQueCambia", () => {
  const previo = {
    name: "GPT-6 Astra",
    pricing: { input: 10, output: 50, cacheRead: 1 },
    providers: ["azure", "openai"],
    programmingRank: 4,
  };

  it("devuelve vacío cuando la fuente republica lo mismo", () => {
    const entrante = {
      name: "GPT-6 Astra",
      // Mismo contenido, otro orden de claves: es lo que hace el parser.
      pricing: { cacheRead: 1, output: 50, input: 10 },
      providers: ["azure", "openai"],
      programmingRank: 4,
    };
    expect(soloLoQueCambia(previo, entrante)).toEqual({});
  });

  it("deja pasar solo el campo que se movió", () => {
    const entrante = { ...previo, pricing: { input: 8, output: 50, cacheRead: 1 } };
    expect(soloLoQueCambia(previo, entrante)).toEqual({
      pricing: { input: 8, output: 50, cacheRead: 1 },
    });
  });

  it("ve un proveedor nuevo", () => {
    const entrante = { ...previo, providers: ["azure", "neon", "openai"] };
    expect(soloLoQueCambia(previo, entrante)).toEqual({
      providers: ["azure", "neon", "openai"],
    });
  });

  it("no propone campos que la fuente no trae", () => {
    expect(soloLoQueCambia(previo, { name: "GPT-6 Astra" })).toEqual({});
  });

  it("ve un campo que antes no existía", () => {
    const sinRank: { name: string; programmingRank?: number } = { name: "X" };
    expect(soloLoQueCambia(sinRank, { programmingRank: 3 })).toEqual({ programmingRank: 3 });
  });
});
