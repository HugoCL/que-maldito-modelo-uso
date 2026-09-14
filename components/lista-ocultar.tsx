"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { ModeloEnLista } from "@/convex/scoring/filtros";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { enlace, excluidosDeIncluidos, type ParamsPortada } from "./params-portada";

/**
 * Isla de cliente: checked = entra en la evaluación. Un GET nativo solo
 * manda los marcados, así que aplicar arma `ocultos` con los desmarcados
 * y el enlace compartido sigue corto. El recálculo ocurre al navegar, con
 * los mismos datos y la misma función que el resto de la barra.
 */
export function ListaOcultar({
  params,
  modelos,
  ocultos,
}: {
  params: ParamsPortada;
  modelos: ModeloEnLista[];
  ocultos: string[];
}) {
  const [incluidos, setIncluidos] = useState(
    () => new Set(modelos.map((m) => m.modelKey).filter((k) => !ocultos.includes(k))),
  );

  const grupos = new Map<string, ModeloEnLista[]>();
  for (const m of modelos) {
    const lista = grupos.get(m.creator) ?? [];
    lista.push(m);
    grupos.set(m.creator, lista);
  }

  const aplicar = (e: FormEvent) => {
    e.preventDefault();
    const ocultosEnUrl = excluidosDeIncluidos(
      modelos.map((m) => m.modelKey),
      incluidos,
    ).join(",");
    // Asignar y no el router: es el mismo contrato que el GET de antes,
    // el servidor vuelve a puntuar con searchParams.
    window.location.assign(enlace(params, { ocultos: ocultosEnUrl }));
  };

  const toggleUno = (clave: string) => {
    setIncluidos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  const toggleGrupo = (lista: ModeloEnLista[]) => {
    const claves = lista.map((m) => m.modelKey);
    const todos = claves.every((k) => incluidos.has(k));
    setIncluidos((prev) => {
      const next = new Set(prev);
      for (const k of claves) {
        if (todos) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  return (
    <details className="group">
      <summary className="cursor-pointer font-mono text-xs text-muted-foreground marker:text-muted-foreground/70">
        {es.filtros.noPuedoUsar}
        {ocultos.length ? ` · ${es.filtros.ocultosN(ocultos.length)}` : ""}
      </summary>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        {es.filtros.noPuedoUsarAyuda}
      </p>
      <form onSubmit={aplicar} className="mt-3 flex flex-col gap-4">
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {[...grupos.entries()].map(([creator, lista]) => {
            const todosEnGrupo = lista.every((m) => incluidos.has(m.modelKey));
            return (
              <fieldset key={creator} className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-1.5 w-full p-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{creator}</span>
                    <button
                      type="button"
                      aria-pressed={todosEnGrupo}
                      onClick={() => toggleGrupo(lista)}
                      className={cn(
                        "font-mono text-[11px] underline-offset-4 hover:underline",
                        todosEnGrupo ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {es.filtros.todosDelGrupo}
                    </button>
                  </span>
                </legend>
                <ul className="flex flex-col gap-1">
                  {lista.map((m) => {
                    const entra = incluidos.has(m.modelKey);
                    return (
                      <li key={m.modelKey}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 font-mono text-[13px] leading-none",
                            entra ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={entra}
                            onChange={() => toggleUno(m.modelKey)}
                            className="size-3.5 shrink-0 accent-foreground"
                          />
                          {m.name}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            className="rounded-lg border border-foreground bg-foreground px-2.5 py-1.5 font-mono text-[13px] leading-none font-medium text-background"
          >
            {es.filtros.aplicarOcultos}
          </button>
          {ocultos.length ? (
            <Link
              href={enlace(params, { ocultos: "" })}
              scroll={false}
              className="font-mono text-[13px] text-muted-foreground underline-offset-4 hover:underline"
            >
              {es.filtros.mostrarTodos}
            </Link>
          ) : null}
        </div>
      </form>
    </details>
  );
}
