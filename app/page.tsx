import { Suspense } from "react";
import Link from "next/link";
import { AvisoSemilla } from "@/components/aviso-semilla";
import {
  BarraDeFiltros,
  catalogoDeModelos,
  enlace,
  fuentesApagadas,
  minimoPedido,
  modelosOcultos,
  type ParamsPortada,
} from "@/components/barra-de-filtros";
import { FilaRecomendacion } from "@/components/fila-recomendacion";
import { FronteraCalidadCosto } from "@/components/frontera-calidad-costo";
import { PortadaHero, SelloCargando } from "@/components/portada-hero";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fechaDeLaSemilla,
  obtenerMetodologia,
  obtenerRecomendaciones,
  obtenerVariantes,
  usandoSemilla,
} from "@/lib/datos";
import { es } from "@/lib/i18n/es";
import { hace } from "@/lib/tiempo";
import type { Recomendaciones } from "@/lib/types";

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<ParamsPortada>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-[940px] flex-col gap-[30px] px-5 py-10 sm:px-[30px] sm:py-[44px]">
      <PortadaHero
        sello={
          <Suspense fallback={<SelloCargando />}>
            <Sello params={params} />
          </Suspense>
        }
      />

      <AvisoSemilla />

      <Suspense
        key={`barra-${params.sin ?? ""}-${params.minimo ?? ""}-${params.ocultos ?? params.sinModelo ?? ""}`}
        fallback={<EsqueletoBarra />}
      >
        <Barra params={params} />
      </Suspense>

      <Suspense key={JSON.stringify(params)} fallback={<Esqueleto />}>
        <Respuestas params={params} />
      </Suspense>
    </main>
  );
}

/**
 * La barra necesita la metodología para saber qué fuentes se pueden apagar y
 * cuántos benchmarks exige el umbral, que es también su opción por defecto.
 */
async function Barra({ params }: { params: ParamsPortada }) {
  const [metodologia, variantes] = await Promise.all([
    obtenerMetodologia(),
    obtenerVariantes(),
  ]);
  return (
    <BarraDeFiltros
      params={params}
      techo={params.max ?? ""}
      metricas={metodologia.metricas}
      umbrales={metodologia.umbrales}
      modelos={catalogoDeModelos(variantes)}
    />
  );
}

/**
 * Los filtros que recortan el conjunto, leídos de la URL.
 *
 * Vive aquí fuera porque lo piden dos sitios: la tabla y el sello del titular.
 * Que los dos partan de la misma función es lo que hace que la línea de arriba
 * cuente lo mismo que se ve debajo.
 */
function filtrosDeLaUrl(params: ParamsPortada) {
  const ocultos = modelosOcultos(params.ocultos ?? params.sinModelo);
  return {
    sin: fuentesApagadas(params.sin),
    minimo: minimoPedido(params.minimo),
    familia: params.familia?.trim() || undefined,
    ocultos: ocultos.length ? ocultos : undefined,
    soloOpenWeights: params.abiertos === "1" || undefined,
  };
}

/**
 * La línea de arriba del titular: con cuánto se ha puntuado y de cuándo es.
 *
 * Pide las mismas recomendaciones que la tabla y con los mismos filtros, así que
 * no es un viaje de más: `obtenerRecomendaciones` no repite la consulta dentro
 * de la misma petición.
 */
async function Sello({ params }: { params: ParamsPortada }) {
  const base = filtrosDeLaUrl(params);
  const [datos, metodologia] = await Promise.all([
    obtenerRecomendaciones(base),
    obtenerMetodologia(),
  ]);
  const benchmarks = metodologia.metricas.filter((m) => !base.sin.includes(m.fuente)).length;

  // De cuándo son los datos es lo que menos se puede perder de esta línea, así
  // que en estrecho lo que se cae es la cuenta de variantes y no la fecha.
  return (
    <p className="truncate font-mono text-[11.5px] leading-none text-muted-foreground">
      {es.portada.benchmarks(benchmarks)}
      <span className="hidden sm:inline"> · {es.portada.variantes(datos.totales.candidatos)}</span> ·{" "}
      {usandoSemilla
        ? `instantánea del ${fechaDeLaSemilla}`
        : (hace(datos.actualizado) ?? es.estado.sinCorridas)}
    </p>
  );
}

async function Respuestas({ params }: { params: ParamsPortada }) {
  const techo = params.max ? Number(params.max) : undefined;
  // Familia, open weight y modelos ocultos recortan el conjunto: las tres
  // respuestas y el gráfico se calculan sobre ese subconjunto. El techo no:
  // vela lo que descarta para que se vea a qué se está renunciando.
  const hayTecho = techo !== undefined;

  const base = filtrosDeLaUrl(params);
  const sin = base.sin;
  const minimo = base.minimo;

  const [universo, filtrada, metodologia] = await Promise.all([
    obtenerRecomendaciones(base),
    hayTecho ? obtenerRecomendaciones({ ...base, presupuestoMax: techo }) : undefined,
    obtenerMetodologia(),
  ]);

  const datos = filtrada ?? universo;
  const tarjetas = datos.tarjetas;
  const elegibles = universo.elegibles;

  if (tarjetas.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-[10px] border border-dashed px-5 py-8 text-center">
        <p className="font-heading text-lg font-semibold">{es.vacio.titulo}</p>
        <p className="mx-auto max-w-md text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {es.vacio.descripcion}
        </p>
        <Link
          href={enlace(params, { max: "", abiertos: "", familia: "", ocultos: "" })}
          className="mt-1 font-mono text-[13px] underline-offset-4 hover:underline"
        >
          {es.filtros.limpiar.toLowerCase()}
        </Link>
      </div>
    );
  }

  const benchmarks = metodologia.metricas.filter((m) => !sin.includes(m.fuente)).length;

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-[10px] border">
        {/* Las cabeceras arriba, que es donde se buscan: antes iban en el pie
            y los números se leían antes de saber qué eran. En estrecho no hay
            columnas y cada cifra lleva su unidad pegada. */}
        <div className="hidden bg-muted/40 px-[22px] py-2.5 font-mono text-[11.5px] text-muted-foreground sm:grid sm:grid-cols-[150px_minmax(0,1fr)_90px_96px] sm:gap-6">
          <span>{es.portada.respuesta}</span>
          <span>{es.portada.modelo}</span>
          <span className="text-right">{es.portada.calidad}</span>
          <span className="opcion justify-end">
            <Link href="/metodologia#indice" className="underline decoration-dotted underline-offset-4">
              {es.portada.costoPorTarea}
            </Link>
            <span className="ayuda">{es.indice.ayuda}</span>
          </span>
        </div>

        {tarjetas.map((t) => (
          <FilaRecomendacion key={t.tier} tarjeta={t} sin={params.sin} />
        ))}

        {/* La frase entera y no solo la ayuda al pasar por encima: en una
            pantalla táctil esa caja no aparece nunca, y decir que el precio es
            un índice no puede depender de tener ratón. */}
        <p className="border-t bg-muted/40 px-4 py-[11px] font-mono text-[11.5px] leading-[1.6] text-muted-foreground sm:px-[22px]">
          {es.portada.pieDeTabla(benchmarks)}{" "}
          <Link href="/metodologia" className="underline underline-offset-4 hover:text-foreground">
            {es.portada.comoSeCalcula}
          </Link>
        </p>
      </div>

      {/* Por qué falta la del día a día, dicho con su motivo y no con un «no hay
          datos» que casi nunca era verdad. Cuando falta otra tarjeta distinta,
          o cuando se ha bajado el mínimo a mano, siguen valiendo las frases de
          antes: son otra cosa. */}
      {datos.sinDiaADia ? (
        <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
          {motivoSinDiaADia(datos.sinDiaADia)}
        </p>
      ) : tarjetas.length < 3 ? (
        <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
          {minimo !== undefined && minimo < metodologia.umbrales.benchmarksMinimos
            ? es.portada.faltanRespuestasConUno
            : es.portada.faltanRespuestas}
        </p>
      ) : null}

      <FronteraCalidadCosto variantes={elegibles} tarjetas={tarjetas} techo={techo} />

      {/* Lo que el gráfico no puede dibujar, dicho en una línea. Son casi todos
          los modelos open weight, y callarlo haría pensar que nadie los
          ha medido cuando lo que pasa es que solo los ha medido uno. */}
      {universo.totales.unaFuente > 0 ? (
        <p className="-mt-1 font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
          {es.portada.unaFuente(universo.totales.unaFuente)}.{" "}
          <Link href="/metodologia#una-fuente" className="underline underline-offset-4">
            {es.portada.unaFuenteEnlace}
          </Link>
        </p>
      ) : null}
    </>
  );
}

/** La frase que le toca a cada motivo, con sus cifras. */
function motivoSinDiaADia(motivo: NonNullable<Recomendaciones["sinDiaADia"]>): string {
  const f = es.portada.sinDiaADia;
  switch (motivo.tipo) {
    case "frontera_corta":
      return f.fronteraCorta(motivo.puntos);
    case "bajo_el_piso":
      return f.bajoElPiso(motivo.mejor.toFixed(0), motivo.piso.toFixed(0));
    case "sin_codo":
      return f.sinCodo;
  }
}

function EsqueletoBarra() {
  return <Skeleton className="h-[9.5rem] w-full rounded-[10px] sm:h-[7.5rem]" />;
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-[30px]">
      <Skeleton className="h-[18rem] w-full rounded-[10px]" />
      <Skeleton className="h-[260px] w-full rounded-[10px] sm:h-[340px]" />
    </div>
  );
}
