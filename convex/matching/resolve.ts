import { MODEL_ALIASES } from "./aliases";
import { keyCandidates, similarity, slugify } from "./normalize";

export type CatalogEntry = { modelKey: string; name: string };

export type Resolution =
  | { ok: true; modelKey: string; via: "exacto" | "alias" | "sufijo" | "nombre" }
  | { ok: false; suggestion?: string; score?: number };

/** Índice de búsqueda sobre el catálogo. Se construye una vez por corrida. */
export type CatalogIndex = {
  byKey: Map<string, string>;
  byName: Map<string, string>;
  keys: string[];
};

export function buildIndex(entries: CatalogEntry[]): CatalogIndex {
  const byKey = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const e of entries) {
    byKey.set(e.modelKey, e.modelKey);
    // El nombre comercial ("Claude Fable 5.1") también sirve de entrada.
    const nameKey = slugify(e.name);
    if (!byName.has(nameKey)) byName.set(nameKey, e.modelKey);
  }
  return { byKey, byName, keys: [...byKey.keys()] };
}

/**
 * De lo que dijo una fuente al modelo del catálogo.
 *
 * Cuatro intentos, de más a menos seguro, y si ninguno convence devolvemos la
 * mejor sugerencia en vez de adivinar: una recomendación con el modelo
 * equivocado es peor que una recomendación de menos.
 */
export function resolveModel(hint: string, index: CatalogIndex): Resolution {
  const candidates = keyCandidates(hint);

  for (const c of candidates) {
    const hit = index.byKey.get(c);
    if (hit) return { ok: true, modelKey: hit, via: "exacto" };
  }

  for (const c of candidates) {
    const alias = MODEL_ALIASES[c];
    if (alias && index.byKey.has(alias)) {
      return { ok: true, modelKey: alias, via: "alias" };
    }
  }

  for (const c of candidates) {
    const hit = index.byName.get(c);
    if (hit) return { ok: true, modelKey: hit, via: "nombre" };
  }

  // "fable-5-1" contra "claude-fable-5-1": el catálogo lleva el fabricante
  // delante y la fuente no. Solo vale si el sufijo es largo, para que
  // "5" no enganche con cualquier cosa.
  for (const c of candidates) {
    if (c.length < 5) continue;
    const matches = index.keys.filter((k) => k === c || k.endsWith(`-${c}`));
    if (matches.length === 1) return { ok: true, modelKey: matches[0], via: "sufijo" };
  }

  const base = candidates[0];
  let best: { key: string; score: number } | null = null;
  for (const key of index.keys) {
    const score = similarity(base, key);
    if (!best || score > best.score) best = { key, score };
  }
  return best && best.score >= 0.55
    ? { ok: false, suggestion: best.key, score: Number(best.score.toFixed(3)) }
    : { ok: false };
}
