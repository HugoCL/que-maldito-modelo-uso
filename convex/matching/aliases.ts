/**
 * Alias manuales, versionados en git.
 *
 * El resolvedor automático cubre la mayoría: normaliza, prueba quitando el
 * prefijo del fabricante y prueba por sufijo. Aquí solo van los casos donde el
 * nombre comercial y el id técnico no se parecen lo suficiente, que es lo
 * normal cuando un benchmark escribe "Fable 5.1" y el catálogo dice
 * "claude-fable-5-1", o cuando dos fabricantes usan la misma palabra.
 *
 * Clave: lo que diga la fuente, ya normalizado con slugify().
 * Valor: el modelKey canónico del catálogo.
 */
export const MODEL_ALIASES: Record<string, string> = {
  // Cursor y Terminal-Bench sueltan el prefijo "claude".
  "fable-5-1": "claude-fable-5-1",
  "fable-5": "claude-fable-5",
  "opus-5": "claude-opus-5",
  "opus-4-8": "claude-opus-4-8",
  "opus-4-7": "claude-opus-4-7",
  "opus-4-6": "claude-opus-4-6",
  "opus-4-5": "claude-opus-4-5",
  "sonnet-5": "claude-sonnet-5",
  "sonnet-4-6": "claude-sonnet-4-6",
  "sonnet-4-5": "claude-sonnet-4-5",
  "haiku-4-5": "claude-haiku-4-5",

};

/** Fabricantes cuyo prefijo se puede quitar sin perder identidad. */
export const VENDOR_PREFIXES = ["claude", "gpt", "gemini", "grok", "glm", "qwen"];
