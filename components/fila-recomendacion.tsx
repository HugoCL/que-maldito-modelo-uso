import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { Tarjeta } from "@/lib/types";

/**
 * Una respuesta es una fila, no una tarjeta.
 *
 * Las tres compiten por la misma decisión, así que lo que importa es poder
 * comparar calidad contra calidad y costo contra costo bajando la vista en
 * línea recta. Tres tarjetas sueltas obligaban a saltar de una a otra
 * buscando dónde estaba cada número.
 *
 * Solo la fila del día a día lleva acento, la barra azul a la izquierda y un
 * cuerpo de letra mayor, porque es la única de las tres que es una
 * recomendación de verdad: las otras dos son respuestas a una restricción que
 * pone quien pregunta.
 *
 * Lo de confianza baja solo puede aparecer aquí si se ha bajado a mano el
 * mínimo de benchmarks, y entonces tiene que ir marcado en la propia fila: una
 * respuesta sostenida por una sola medición y otra por tres no se pueden ver
 * igual solo porque las dos hayan salido del mismo cálculo.
 */
export function FilaRecomendacion({ tarjeta, sin }: { tarjeta: Tarjeta; sin?: string }) {
  const { tier, ganador, razonCorta, alternativas } = tarjeta;
  // Las fuentes apagadas viajan con el enlace: si no, la ficha puntuaría con
  // todas y enseñaría una calidad distinta de la que acaba de leerse aquí.
  const ficha = (modelKey: string) => (sin ? `/modelo/${modelKey}?sin=${sin}` : `/modelo/${modelKey}`);
  const t = es.tiers[tier];
  const destacada = tier === "dia_a_dia";

  return (
    <div
      className={cn(
        // En estrecho la fila se apila (etiqueta, modelo, cifras) y solo a
        // partir de `sm` se convierte en las cuatro columnas que permiten
        // comparar en vertical, que es para lo que existe.
        "flex flex-col gap-2 border-t border-border px-4 py-5 first:border-t-0",
        "sm:grid sm:grid-cols-[150px_minmax(0,1fr)_90px_96px] sm:items-center sm:gap-6 sm:px-[22px]",
        destacada && "border-l-[3px] border-l-primary sm:py-6",
      )}
    >
      <span
        className={cn(
          "font-mono text-xs leading-[1.4]",
          destacada ? "text-primary" : "text-muted-foreground",
        )}
      >
        {t.orden} {t.etiqueta}
        <br className="hidden sm:inline" />
        <span className="text-muted-foreground before:content-['_·_'] sm:before:content-none">
          {t.nota}
        </span>
      </span>

      <div className="flex flex-col gap-1">
        <p
          className={cn(
            "font-heading font-semibold tracking-[-0.02em]",
            destacada ? "text-[26px] leading-[1.12] tracking-[-0.025em]" : "text-[22px] leading-[1.15]",
          )}
        >
          <Link
            href={ficha(ganador.modelKey)}
            className="underline-offset-4 hover:underline"
          >
            {ganador.modelName}
          </Link>
          {ganador.effort !== "default" ? (
            <span
              className={cn(
                "ml-2 font-mono font-normal text-muted-foreground",
                destacada ? "text-sm" : "text-[13px]",
              )}
            >
              {ganador.effort}
            </span>
          ) : null}
          {ganador.confidence === "baja" ? <Baja /> : null}
        </p>
        <p
          className={cn(
            "text-pretty leading-[1.4]",
            destacada ? "text-[13.5px] text-foreground/75" : "text-[13px] text-muted-foreground",
          )}
        >
          {razonCorta}
        </p>

        {/* Plegado por defecto: el diseño pide una línea de texto por fila, y
            las suplentes solo hacen falta cuando la recomendada no te sirve.
            <details> lo resuelve sin una línea de JavaScript. */}
        {alternativas.length ? (
          <details className="group mt-0.5">
            <summary
              title={es.portada.sinAcceso}
              className="w-fit cursor-pointer list-none font-mono text-[11.5px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"
            >
              <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
              {es.portada.alternativas(alternativas.length)}
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {alternativas.map((a) => (
                <li
                  key={a.variantKey}
                  className="flex items-baseline justify-between gap-4 font-mono text-[11.5px] text-muted-foreground tabular-nums"
                >
                  <span className="flex min-w-0 items-baseline">
                    <Link
                      href={ficha(a.modelKey)}
                      className="truncate underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {a.modelName}
                      {a.effort !== "default" ? ` ${a.effort}` : ""}
                    </Link>
                    {a.confidence === "baja" ? <Baja /> : null}
                  </span>
                  <span className="shrink-0">
                    {a.quality.toFixed(0)} · {a.cost !== undefined ? `$${a.cost.toFixed(2)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="flex items-baseline gap-6 font-mono tabular-nums sm:contents">
        <span className={cn("sm:text-right", destacada ? "text-[19px]" : "text-[17px]")}>
          {ganador.quality.toFixed(0)}
          <span className="text-xs text-muted-foreground">{es.portada.deCien}</span>
        </span>
        <span className={cn("sm:text-right", destacada ? "text-[19px]" : "text-[17px]")}>
          {ganador.cost !== undefined ? `$${ganador.cost.toFixed(2)}` : "—"}
        </span>
      </div>
    </div>
  );
}

/**
 * La marca de una nota sostenida por un solo benchmark.
 *
 * Un borde punteado y no un color de alarma: no dice que el modelo sea peor,
 * dice que hay menos medido. El `title` lleva la frase entera para quien se
 * pare encima, y el texto ya se lee solo para quien no.
 */
function Baja() {
  return (
    <span
      title={es.tarjeta.confianzaBajaNota}
      className="ml-2 shrink-0 rounded border border-dashed px-1.5 py-px align-middle font-mono text-[10.5px] font-normal whitespace-nowrap text-muted-foreground"
    >
      {es.tarjeta.confianzaBaja}
    </span>
  );
}
