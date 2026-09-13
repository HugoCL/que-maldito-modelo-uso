import type { CatalogSource, ParsedCatalogEntry } from "./types";
import { slugify } from "../matching/normalize";

/**
 * models.dev: base comunitaria de modelos, MIT, actualizada a diario.
 * Es nuestro catálogo canónico: precios, contexto, modalidades y fechas.
 *
 * El archivo trae 213 proveedores y ~7700 filas porque el mismo modelo aparece
 * bajo cada gateway que lo revende. Tomamos la identidad y el precio del
 * proveedor de primera mano (el que hizo el modelo) y usamos al resto solo
 * como señal de disponibilidad, que es lo que le importa a alguien decidiendo
 * si puede usarlo.
 */

/** Proveedores de primera mano, en orden de preferencia. */
const FIRST_PARTY: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  deepseek: "DeepSeek",
  moonshotai: "Moonshot AI",
  zhipuai: "Z.ai",
  zai: "Z.ai",
  meta: "Meta",
  mistral: "Mistral",
  alibaba: "Alibaba",
  minimax: "MiniMax",
  tencent: "Tencent",
  xiaomi: "Xiaomi",
  upstage: "Upstage",
  cohere: "Cohere",
  ai21: "AI21",
  amazon: "Amazon",
  microsoft: "Microsoft",
  inclusionai: "InclusionAI",
};

type RawModel = {
  id?: string;
  name?: string;
  description?: string;
  family?: string;
  release_date?: string;
  last_updated?: string;
  knowledge?: string;
  open_weights?: boolean;
  tool_call?: boolean;
  reasoning?: boolean;
  reasoning_options?: Array<{ type?: string; values?: string[] }>;
  limit?: { context?: number; output?: number };
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
};

type RawProvider = { id?: string; name?: string; models?: Record<string, RawModel> };

export function parse(body: string): ParsedCatalogEntry[] {
  const data = JSON.parse(body) as Record<string, RawProvider>;

  // Paso 1: dónde se puede conseguir cada modelo, mirando a todos los gateways.
  const availability = new Map<string, Set<string>>();
  for (const [providerId, provider] of Object.entries(data)) {
    for (const modelId of Object.keys(provider.models ?? {})) {
      const key = slugify(modelId.split("/").pop() ?? modelId);
      if (!availability.has(key)) availability.set(key, new Set());
      availability.get(key)!.add(providerId);
    }
  }

  // Paso 2: identidad y precio, del proveedor de primera mano.
  const out = new Map<string, ParsedCatalogEntry>();
  for (const [providerId, creator] of Object.entries(FIRST_PARTY)) {
    const provider = data[providerId];
    if (!provider?.models) continue;

    for (const [modelId, model] of Object.entries(provider.models)) {
      const modelKey = slugify(modelId);
      // El primer proveedor de la lista que lo tenga se queda con la ficha.
      if (out.has(modelKey)) continue;

      const efforts = (model.reasoning_options ?? [])
        .filter((o) => o.type === "effort")
        .flatMap((o) => o.values ?? []);

      out.set(modelKey, {
        modelKey,
        name: model.name ?? modelId,
        creator,
        creatorSlug: slugify(creator),
        family: model.family,
        description: model.description,
        releaseDate: model.release_date,
        knowledgeCutoff: model.knowledge,
        openWeights: model.open_weights,
        contextLimit: model.limit?.context,
        outputLimit: model.limit?.output,
        pricing: model.cost && {
          input: model.cost.input,
          output: model.cost.output,
          cacheRead: model.cost.cache_read,
          cacheWrite: model.cost.cache_write,
        },
        supportedEfforts: efforts.length ? efforts : undefined,
        providers: [...(availability.get(modelKey) ?? [])].sort(),
        toolCall: model.tool_call,
      });
    }
  }
  return [...out.values()];
}

export const modelsDev: CatalogSource = {
  id: "modelsdev",
  kind: "catalogo",
  name: "models.dev",
  homepage: "https://models.dev",
  url: "https://models.dev/api.json",
  attribution: "Catálogo y precios: models.dev",
  license: "MIT",
  enabled: true,
  parse,
};
