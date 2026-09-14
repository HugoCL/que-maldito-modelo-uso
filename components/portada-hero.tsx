import type { ReactNode } from "react";
import { TituloMutante } from "@/components/titulo-mutante";
import { es } from "@/lib/i18n/es";

/**
 * El titular de la portada.
 *
 * Antes era un `<h1>` y una línea, y se leía como el encabezado de un documento
 * en vez de como la respuesta a una pregunta. Ahora son tres cosas: la línea
 * viva de arriba, que dice de cuándo son los datos y cuántos hay; el nombre, con
 * su palabrota tapándose sola; y el lema.
 *
 * La línea viva llega por `sello` y no se calcula aquí porque necesita una
 * consulta, y este componente tiene que salir del servidor sin esperar a nadie:
 * el titular es lo primero que se pinta y no puede quedarse detrás de una
 * consulta a la base. Quien la pasa la envuelve en su propio `Suspense`.
 *
 * El fondo (el resplandor y la retícula) es CSS puro colgado de `.hero`, en
 * app/globals.css. No se mueve: lo único que se mueve en esta pantalla es la
 * palabrota, y dos cosas moviéndose son una de más.
 */
export function PortadaHero({ sello }: { sello?: ReactNode }) {
  return (
    <section className="hero flex flex-col gap-3 pt-1">
      {/* Altura fija: esta línea llega más tarde que el resto y sin reservarle
          el sitio empujaría el titular hacia abajo al aparecer. */}
      <div className="flex h-4 items-center">{sello}</div>

      <TituloMutante
        texto={es.marca.nombreEntero}
        palabra={es.marca.palabrota}
        className="max-w-[680px] text-balance font-heading text-[38px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[54px]"
      />

      <p className="max-w-[520px] text-pretty text-[16px] leading-[1.45] text-foreground/70 sm:text-[17px]">
        {es.marca.lema}
      </p>
    </section>
  );
}

/** El esqueleto de la línea viva, del ancho aproximado de la frase que sustituye. */
export function SelloCargando() {
  return <span className="h-[11px] w-52 animate-pulse rounded bg-muted" />;
}
