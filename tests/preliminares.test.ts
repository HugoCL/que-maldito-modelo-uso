import { describe, expect, it } from "vitest";
import { construirEscala, scoreAll, type Candidate } from "../convex/scoring/compute";
import {
  estadoDelPreliminar,
  sumarPreliminares,
  type ModeloDelCatalogo,
  type Preliminar,
} from "../convex/scoring/preliminares";
import { validarPreliminar } from "../convex/scoring/reglasDePreliminares";

const modelo = (modelKey: string): ModeloDelCatalogo => ({
  modelKey,
  modelName: modelKey.toUpperCase(),
  creator: "Lab",
  pricing: { input: 1, output: 5 },
  providers: [],
});

const medido = (
  modelKey: string,
  effort: Candidate["effort"],
  metrics: Array<[Candidate["metrics"][number]["metric"], number]>,
): Candidate => ({
  ...modelo(modelKey),
  variantKey: `${modelKey}@${effort}`,
  effort,
  metrics: metrics.map(([metric, value]) => ({ metric, value })),
  costSamples: [{ sourceId: "deepswe", costPerTask: 1 }],
});

const catalogo = new Map(["viejo", "nuevo"].map((k) => [k, modelo(k)]));

const base: Candidate[] = [
  medido("viejo", "high", [
    ["deepswe.pass_at_1", 0.5],
    ["terminalbench.accuracy", 0.4],
  ]),
  medido("otro", "default", [
    ["deepswe.pass_at_1", 0.3],
    ["terminalbench.accuracy", 0.2],
  ]),
];

describe("sumarPreliminares", () => {
  it("un modelo que nadie midió entra con sus preliminares marcados", () => {
    const p: Preliminar[] = [
      { modelKey: "nuevo", effort: "high", metric: "deepswe.pass_at_1", value: 0.6, fuenteUrl: "https://lab" },
      { modelKey: "nuevo", effort: "high", metric: "terminalbench.accuracy", value: 0.5 },
    ];
    const todos = sumarPreliminares(base, p, catalogo);
    const nuevo = todos.find((c) => c.variantKey === "nuevo@high")!;
    expect(nuevo.modelName).toBe("NUEVO");
    expect(nuevo.costSamples).toEqual([]);
    expect(nuevo.metrics.every((m) => m.preliminar)).toBe(true);
    expect(nuevo.metrics[0].fuenteUrl).toBe("https://lab");
    expect(todos.map((c) => c.variantKey)).toEqual([...todos.map((c) => c.variantKey)].sort());
  });

  it("el valor oficial sobrescribe al preliminar de la misma métrica, y solo a esa", () => {
    const p: Preliminar[] = [
      { modelKey: "viejo", effort: "high", metric: "deepswe.pass_at_1", value: 0.99 },
      { modelKey: "viejo", effort: "high", metric: "cursorbench.score", value: 0.7 },
    ];
    const viejo = sumarPreliminares(base, p, catalogo).find((c) => c.variantKey === "viejo@high")!;
    expect(viejo.metrics.find((m) => m.metric === "deepswe.pass_at_1")).toEqual({
      metric: "deepswe.pass_at_1",
      value: 0.5,
    });
    expect(viejo.metrics.find((m) => m.metric === "cursorbench.score")?.preliminar).toBe(true);
  });

  it("un preliminar sin effort lo sobrescribe cualquier effort medido", () => {
    const p: Preliminar = { modelKey: "viejo", effort: "default", metric: "deepswe.pass_at_1", value: 0.9 };
    expect(estadoDelPreliminar(p, base, () => true)).toEqual({ tipo: "reemplazado", porEffort: "high" });
    expect(sumarPreliminares(base, [p], catalogo).some((c) => c.variantKey === "viejo@default")).toBe(false);
  });

  it("uno con effort no lo sobrescribe la medición de otro effort", () => {
    const p: Preliminar = { modelKey: "viejo", effort: "max", metric: "deepswe.pass_at_1", value: 0.9 };
    expect(estadoDelPreliminar(p, base, () => true)).toEqual({ tipo: "cuenta" });
  });

  it("sin el modelo en el catálogo espera, sin inventar una variante", () => {
    const p: Preliminar = { modelKey: "futuro", effort: "high", metric: "deepswe.pass_at_1", value: 0.9 };
    expect(estadoDelPreliminar(p, base, (k) => catalogo.has(k))).toEqual({ tipo: "sin_modelo" });
    expect(sumarPreliminares(base, [p], catalogo)).toHaveLength(base.length);
  });
});

describe("preliminares y la escala", () => {
  it("no mueven la nota de nadie más", () => {
    const p: Preliminar[] = [
      { modelKey: "nuevo", effort: "high", metric: "deepswe.pass_at_1", value: 0.95 },
      { modelKey: "nuevo", effort: "high", metric: "terminalbench.accuracy", value: 0.9 },
    ];
    const con = sumarPreliminares(base, p, catalogo);
    expect(construirEscala(con)).toEqual(construirEscala(base));

    const antes = scoreAll(base, 0);
    const despues = scoreAll(con, 0);
    for (const s of antes) {
      expect(despues.find((d) => d.variantKey === s.variantKey)!.quality).toBe(s.quality);
    }
    const nuevo = despues.find((d) => d.variantKey === "nuevo@high")!;
    expect(nuevo.preliminar).toBe(true);
    expect(nuevo.benchmarks).toBe(2);
    expect(despues.find((d) => d.variantKey === "viejo@high")!.preliminar).toBe(false);
  });
});

describe("validarPreliminar", () => {
  const ok = { modelo: "nuevo", valores: [{ metric: "deepswe.pass_at_1", value: 0.5 }] };

  it("acepta lo razonable", () => {
    expect(validarPreliminar(ok)).toBeNull();
    expect(validarPreliminar({ ...ok, fuenteUrl: "https://x.dev/a", measuredAt: "2026-09-23" })).toBeNull();
  });

  it("rechaza lo que no tiene sentido", () => {
    expect(validarPreliminar({ ...ok, modelo: " " })).not.toBeNull();
    expect(validarPreliminar({ ...ok, valores: [] })).not.toBeNull();
    expect(validarPreliminar({ ...ok, valores: [{ metric: "deepswe.pass_at_1", value: 85 }] })).not.toBeNull();
    expect(validarPreliminar({ ...ok, valores: [...ok.valores, ...ok.valores] })).not.toBeNull();
    expect(validarPreliminar({ ...ok, fuenteUrl: "javascript:alert(1)" })).not.toBeNull();
    expect(validarPreliminar({ ...ok, measuredAt: "23/09/2026" })).not.toBeNull();
  });
});
