"use client";

import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { Variante } from "@/lib/types";

/**
 * La cuenta que lleva de los benchmarks a la nota, escrita con sus números.
 *
 * Esto estuvo primero como dos filas más del desglose —la media y esa media
 * promediada con el centro— y no bastaba: enseñaba en qué se convertía cada
 * número pero no la operación, así que seguía habiendo que creerse el salto.
 * Aquí van las cuatro cuentas tal cual se hacen, con paréntesis, para que se
 * puedan repetir a mano sin salir de la página.
 *
 * Es cliente, y es la única isla de la ficha. Un globo que se pueda abrir no se
 * puede hacer desde el servidor, y el resto de la página no tiene por qué
 * pagarlo. Va con el globo de la librería y no con el truco de CSS que usa la
 * barra de filtros porque las dos tablas viven dentro de un contenedor que
 * recorta: este portaliza, y el de CSS saldría cortado por el borde.
 */

export type EscalaDeLaNota = {
  k: number;
  centroNivelado?: number;
  extremos?: { min: number; max: number };
};

/** Un decimal en todo, que es como se enseña cada número de esta página. */
const n1 = (x: number) => x.toFixed(1);

/** El signo va delante y separado: la cuenta se lee, no se descifra. */
const sumando = (x: number) => `${x < 0 ? "−" : "+"} ${Math.abs(x).toFixed(1)}`;

/**
 * La evidencia casi siempre es un entero —cuántos benchmarks te midieron— y
 * escribir "3.00" ahí haría pensar que es otra cosa. El decimal solo aparece
 * cuando de verdad lo hay, o sea cuando algún benchmark está descontado por
 * viejo y cuenta menos de uno.
 */
const cuenta = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

/**
 * Los pesos son iguales mientras ningún benchmark esté descontado por
 * antigüedad, y entonces la media es la de toda la vida. Cuando dejan de serlo
 * la cuenta cambia de forma, y enseñar la de siempre sería enseñar una que no
 * se hizo.
 */
function formulaDeLaMedia(metricas: Variante["metricas"], media: number): string {
  const nivelados = metricas.map((m) => m.normalizado - m.desnivel);
  const iguales = metricas.every((m) => Math.abs(m.peso - metricas[0].peso) < 0.005);

  if (iguales) {
    return `(${nivelados.map(n1).join(" + ")}) / ${metricas.length} = ${n1(media)}`;
  }
  const arriba = metricas.map((m, i) => `${n1(nivelados[i])}×${m.peso}`).join(" + ");
  const abajo = metricas.reduce((a, m) => a + m.peso, 0);
  return `(${arriba}) / ${n1(abajo)} = ${n1(media)}`;
}

export function CuentaDeLaNota({
  variante: v,
  escala,
  className,
  children,
}: {
  variante: Variante;
  escala: EscalaDeLaNota;
  className?: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  // Sin los pasos intermedios no hay cuenta que enseñar, y media cuenta es
  // peor que ninguna: entonces el número se queda como estaba, sin globo.
  const completa =
    v.media !== undefined &&
    v.acercada !== undefined &&
    v.evidencia !== undefined &&
    escala.centroNivelado !== undefined &&
    escala.extremos !== undefined &&
    v.metricas.length > 0;

  if (!completa) return <span className={className}>{children}</span>;

  const media = v.media!;
  const acercada = v.acercada!;
  const { min, max } = escala.extremos!;
  const centro = escala.centroNivelado!;
  const ev = v.evidencia!;

  const pasos = [
    v.metricas.length > 1 && {
      titulo: es.cuenta.media,
      formula: formulaDeLaMedia(v.metricas, media),
    },
    {
      titulo: es.cuenta.centro(n1(centro), escala.k.toFixed(2)),
      formula: `(${cuenta(ev)} × ${n1(media)} + ${escala.k.toFixed(2)} × ${n1(centro)}) / (${cuenta(ev)} + ${escala.k.toFixed(2)}) = ${n1(acercada)}`,
    },
    {
      titulo: es.cuenta.escalaFinal,
      formula: `(${n1(acercada)} − ${n1(min)}) / (${n1(max)} − ${n1(min)}) × 100 = ${n1(v.quality)}`,
    },
  ].filter((p): p is { titulo: string; formula: string } => Boolean(p));

  return (
    <Tooltip open={abierto} onOpenChange={setAbierto}>
      <TooltipTrigger
        // `closeOnClick` apagado y el clic alterna a mano: con ratón el globo
        // ya sale al pasar por encima, y el clic es para el táctil, donde no
        // hay hover y sin esto la cuenta no se podría leer nunca.
        closeOnClick={false}
        // Sin esto la espera por defecto pasa del medio segundo, que en un
        // número que invita a comprobarlo se siente como que no responde.
        delay={120}
        onClick={() => setAbierto((x) => !x)}
        className={cn(
          "cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-[5px] outline-none focus-visible:decoration-foreground",
          className,
        )}
        aria-label={es.cuenta.aria(n1(v.quality))}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="w-[min(25rem,calc(100vw-2rem))] max-w-none flex-col items-stretch gap-2.5 rounded-xl px-3.5 py-3"
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-wide uppercase opacity-60">
            {es.cuenta.nivelado}
          </span>
          {v.metricas.map((m) => (
            <div key={m.metric} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-[11px] opacity-80">
                {m.etiqueta}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums">
                {m.desnivel === 0
                  ? n1(m.normalizado)
                  : `${n1(m.normalizado)} ${sumando(-m.desnivel)} = ${n1(m.normalizado - m.desnivel)}`}
              </span>
            </div>
          ))}
        </div>

        {pasos.map((p) => (
          <div key={p.titulo} className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] tracking-wide uppercase opacity-60">
              {p.titulo}
            </span>
            <span className="font-mono text-[11px] leading-[1.45] tabular-nums">{p.formula}</span>
          </div>
        ))}

        <span className="text-[10.5px] leading-[1.4] opacity-55">{es.cuenta.redondeo}</span>
      </TooltipContent>
    </Tooltip>
  );
}
