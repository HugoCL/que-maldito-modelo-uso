import type { Effort } from "../sources/types";

/** minúsculas, sin acentos, todo lo no alfanumérico a guiones. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const EFFORT_ALIASES: Record<string, Effort> = {
  minimal: "minimal",
  min: "minimal",
  none: "default",
  default: "default",
  low: "low",
  medium: "medium",
  med: "medium",
  high: "high",
  xhigh: "xhigh",
  "x-high": "xhigh",
  "extra-high": "xhigh",
  "extrahigh": "xhigh",
  "very-high": "xhigh",
  max: "max",
  maximum: "max",
};

export function normalizeEffort(raw: string | undefined | null): Effort {
  if (!raw) return "default";
  const key = slugify(raw);
  return EFFORT_ALIASES[key] ?? "default";
}

/**
 * Separa el nivel de reasoning effort del nombre del modelo.
 *
 * CursorBench escribe "Fable 5.1 Extra High"; SWE-bench escribe
 * "... + Claude 4.5 Opus medium (20251101)". Solo se corta si el sufijo es un
 * effort conocido, para no mutilar nombres como "GPT-5.6 Sol" o "GLM 5.3 Flash"
 * ("flash" no está en la tabla, así que sobrevive).
 */
export function splitEffort(name: string): { base: string; effort: Effort } {
  let cleaned = name.trim().replace(/\s+/g, " ");

  // SWE-rebench escribe "DeepSeek-V4 Pro [high]" y "Claude Opus 4.8-xhigh".
  const bracket = cleaned.match(/^(.*?)\s*\[([^\]]+)\]$/);
  if (bracket) {
    const effort = EFFORT_ALIASES[slugify(bracket[2])];
    if (effort) return { base: bracket[1].trim(), effort };
    cleaned = bracket[1].trim();
  }

  const hyphen = cleaned.match(/^(.*)-([A-Za-z]+)$/);
  if (hyphen) {
    const effort = EFFORT_ALIASES[slugify(hyphen[2])];
    // "claude-fable-5-1" no se toca; "Claude Opus 4.8-xhigh" sí.
    if (effort && effort !== "default") return { base: hyphen[1].trim(), effort };
  }

  const words = cleaned.split(" ");

  // Prueba primero dos palabras ("Extra High"), luego una ("Max").
  for (const take of [2, 1]) {
    if (words.length <= take) continue;
    const tail = words.slice(-take).join("-");
    const effort = EFFORT_ALIASES[slugify(tail)];
    if (effort) {
      return { base: words.slice(0, -take).join(" "), effort };
    }
  }
  return { base: cleaned, effort: "default" };
}

/**
 * Variantes de una clave que valen la pena probar contra el catálogo.
 * "fable-5-1" debe poder alcanzar "claude-fable-5-1", y "gpt-5-6-sol" debe
 * sobrevivir a que la fuente lo escriba "GPT-5.6 Sol".
 */
export function keyCandidates(hint: string): string[] {
  const base = slugify(hint);
  const out = new Set<string>([base]);

  // "claude-fable-5-1" -> "fable-5-1" (y al revés lo resuelve el sufijo).
  const withoutVendor = base.replace(
    /^(claude|gpt|gemini|grok|glm|qwen|deepseek|kimi|muse|minimax|llama|mistral|command|nova|solar|hy|mimo)-/,
    "",
  );
  if (withoutVendor !== base) out.add(withoutVendor);

  // "anthropic/claude-fable-5-1" ya viene con el proveedor delante.
  const afterSlash = hint.includes("/") ? slugify(hint.split("/").pop()!) : null;
  if (afterSlash) out.add(afterSlash);

  // Los sufijos de fecha estorban: "claude-sonnet-4-5-20250929".
  const withoutDate = base.replace(/-20\d{6}$/, "");
  if (withoutDate !== base) out.add(withoutDate);

  return [...out];
}

/** Distancia de Levenshtein, acotada: solo se usa para sugerir. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 1 = idénticas, 0 = nada que ver. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}
