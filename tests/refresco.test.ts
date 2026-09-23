import { describe, expect, it } from "vitest";
import {
  LARGO_MINIMO_DEL_TOKEN,
  RUN_COLGADO_TRAS_MS,
  runEnCurso,
  tokenValido,
} from "../convex/ingest/reglasDelRefresco";

const secreto = "x".repeat(LARGO_MINIMO_DEL_TOKEN);

describe("tokenValido", () => {
  it("acepta el token exacto", () => {
    expect(tokenValido(secreto, secreto)).toBe(true);
  });

  it("rechaza uno distinto, más corto o más largo", () => {
    expect(tokenValido(secreto.slice(0, -1) + "y", secreto)).toBe(false);
    expect(tokenValido(secreto.slice(1), secreto)).toBe(false);
    expect(tokenValido(secreto + "x", secreto)).toBe(false);
    expect(tokenValido("", secreto)).toBe(false);
  });

  it("sin token configurado, o con uno corto, no deja pasar a nadie", () => {
    expect(tokenValido("", undefined)).toBe(false);
    expect(tokenValido("", "")).toBe(false);
    expect(tokenValido("corto", "corto")).toBe(false);
  });
});

describe("runEnCurso", () => {
  const ahora = 1_000_000_000;

  it("sin bitácora o con el último run terminado, no hay nada en marcha", () => {
    expect(runEnCurso(null, ahora)).toBe(false);
    expect(runEnCurso({ startedAt: ahora - 1000, finishedAt: ahora - 10 }, ahora)).toBe(false);
  });

  it("un run abierto y reciente sigue en marcha", () => {
    expect(runEnCurso({ startedAt: ahora - 1000 }, ahora)).toBe(true);
  });

  it("un run abierto de hace rato se dio por caído y no bloquea el siguiente", () => {
    expect(runEnCurso({ startedAt: ahora - RUN_COLGADO_TRAS_MS }, ahora)).toBe(false);
  });
});
