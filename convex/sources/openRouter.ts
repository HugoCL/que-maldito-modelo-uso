import type { CatalogSource, ParsedCatalogEntry } from "./types";
import { slugify } from "../matching/normalize";

/**
 * OpenRouter — segunda opinión sobre precios y, sobre todo, disponibilidad
 * real: si un modelo está aquí, cualquiera puede usarlo sin contrato directo.
 *
 * Los precios vienen como USD por token en cadenas ("0.00001"); los pasamos a
 * USD por millón para que empaten con models.dev.
 */

type RawModel = {
  id?: string;
  canonical_slug?: string;
  name?: string;
  description?: string;
  context_length?: number;
  created?: number;
  knowledge_cutoff?: string | null;
  alias_target?: unknown;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  top_provider?: { max_completion_tokens?: number | null };
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  };
  supported_parameters?: string[];
  reasoning?: { supported_efforts?: string[] };
};

const perMillion = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n * 1_000_000 : undefined;
};

function toEntry(m: RawModel): ParsedCatalogEntry | null {
  // Los ids con "~" son alias móviles ("...-latest"): no son un modelo.
  if (!m.id || m.id.startsWith("~") || m.alias_target) return null;

  const [vendor, rest] = m.id.includes("/") ? m.id.split("/", 2) : ["", m.id];
  const modelKey = slugify(rest);
  const creator = m.name?.includes(":") ? m.name.split(":")[0].trim() : vendor;

  return {
    modelKey,
    name: m.name?.replace(/^[^:]+:\s*/, "") ?? rest,
    creator: creator || vendor,
    creatorSlug: slugify(vendor),
    description: m.description,
    contextLimit: m.context_length,
    outputLimit: m.top_provider?.max_completion_tokens ?? undefined,
    knowledgeCutoff: m.knowledge_cutoff ?? undefined,
    pricing: {
      input: perMillion(m.pricing?.prompt),
      output: perMillion(m.pricing?.completion),
      cacheRead: perMillion(m.pricing?.input_cache_read),
      cacheWrite: perMillion(m.pricing?.input_cache_write),
    },
    supportedEfforts: m.reasoning?.supported_efforts,
    providers: ["openrouter"],
    toolCall: m.supported_parameters?.includes("tools"),
  };
}

export function parse(body: string): ParsedCatalogEntry[] {
  const { data } = JSON.parse(body) as { data: RawModel[] };
  const out: ParsedCatalogEntry[] = [];
  for (const m of data ?? []) {
    const entry = toEntry(m);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * El mismo endpoint filtrado por categoría devuelve el top de uso real en
 * programación. No es calidad: es qué está usando la gente, que sirve como
 * contrapeso cuando dos modelos empatan en los benchmarks.
 */
export function parseProgramming(body: string): ParsedCatalogEntry[] {
  const { data } = JSON.parse(body) as { data: RawModel[] };
  const out: ParsedCatalogEntry[] = [];
  (data ?? []).forEach((m, index) => {
    const entry = toEntry(m);
    if (!entry) return;
    out.push({
      modelKey: entry.modelKey,
      name: entry.name,
      creator: entry.creator,
      creatorSlug: entry.creatorSlug,
      programmingRank: index + 1,
    });
  });
  return out;
}

export const openRouter: CatalogSource = {
  id: "openrouter",
  kind: "catalogo",
  name: "OpenRouter",
  homepage: "https://openrouter.ai",
  url: "https://openrouter.ai/api/v1/models",
  attribution: "Disponibilidad y precios cruzados: OpenRouter",
  license: "API pública sin autenticación.",
  enabled: true,
  parse,
};

export const openRouterProgramming: CatalogSource = {
  id: "openrouter-programming",
  kind: "catalogo",
  name: "OpenRouter · uso en programación",
  homepage: "https://openrouter.ai/rankings",
  url: "https://openrouter.ai/api/v1/models?category=programming",
  attribution: "Ranking de uso en programación: OpenRouter",
  license: "API pública sin autenticación.",
  enabled: true,
  parse: parseProgramming,
};
