/**
 * Lo que el tema necesita saber en los dos lados.
 *
 * Vive aquí y no en `components/interruptor-tema.tsx` porque ese archivo es un
 * componente de cliente, y lo que un componente de servidor importa de un
 * `"use client"` no es el valor sino una referencia al componente: la constante
 * llegaba como `undefined` y el guion del layout acababa preguntando por
 * `localStorage.getItem(undefined)`, que nunca es nada. Un archivo sin marca de
 * cliente se puede importar desde los dos sitios y es el mismo valor.
 */
export const CLAVE_TEMA = "tema";

export const CONSULTA_OSCURO = "(prefers-color-scheme: dark)";

export const TEMAS = ["sistema", "claro", "oscuro"] as const;
export type Tema = (typeof TEMAS)[number];

export const esTema = (v: string | null): v is Tema =>
  !!v && (TEMAS as readonly string[]).includes(v);
