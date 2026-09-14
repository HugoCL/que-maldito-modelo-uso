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
import { TituloMutante } from "@/components/titulo-mutante";
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

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<ParamsPortada>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-[940px] flex-col gap-[30px] px-5 py-10 sm:px-[30px] sm:py-[40px]">
      <section className="flex flex-col gap-2.5">
        <TituloMutante
          texto={es.marca.nombreEntero}
          palabra={es.marca.palabrota}
          className="max-w-[640px] text-balance font-heading text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[44px]"
        />
        <p className="text-[15px] leading-[1.5] text-muted-foreground">{es.marca.lema}</p>
      </section>

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

async function Respuestas({ params }: { params: ParamsPortada }) {
  const techo = params.max ? Number(params.max) : undefined;
  const soloAbiertos = params.abiertos === "1";
  const sin = fuentesApagadas(params.sin);
  const minimo = minimoPedido(params.minimo);
  const familia = params.familia?.trim() || undefined;
  const ocultos = modelosOcultos(params.ocultos ?? params.sinModelo);
  // Familia, open weight y modelos ocultos recortan el conjunto: las tres
  // respuestas y el gráfico se calculan sobre ese subconjunto. El techo no:
  // vela lo que descarta para que se vea a qué se está renunciando.
  const hayTecho = techo !== undefined;

  const base = {
    sin,
    minimo,
    familia,
    ocultos: ocultos.length ? ocultos : undefined,
    soloOpenWeights: soloAbiertos || undefined,
  };

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

  // El sello nombra lo que produce los dos números de arriba: los benchmarks
  // que puntúan la calidad y el catálogo del que salen precios y fechas. La
  // atribución completa, con enlaces (que es lo que piden las licencias), va
  // en el pie de página y sale de esta misma lista.
  // Sin las apagadas: este sello nombra lo que produjo los dos números de
  // arriba, así que no puede seguir firmando con una fuente que no ha contado.
  const activas = metodologia.fuentes.filter((f) => f.activa && !sin.includes(f.id));
  const fuentes = [
    ...activas.filter((f) => f.tipo === "benchmark"),
    ...activas.filter((f) => f.tipo === "catalogo").slice(0, 1),
  ].map((f) => f.nombre);

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-[10px] border">
        {tarjetas.map((t) => (
          <FilaRecomendacion key={t.tier} tarjeta={t} sin={params.sin} />
        ))}

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t bg-muted/40 px-4 py-[11px] font-mono text-[11.5px] text-muted-foreground sm:grid sm:grid-cols-[150px_minmax(0,1fr)_90px_96px] sm:gap-6 sm:px-[22px]">
          <span className="hidden sm:block" />
          <span>{es.portada.pieDeTabla(metodologia.metricas.filter((m) => !sin.includes(m.fuente)).length)}</span>
          <span className="hidden sm:block sm:text-right">{es.portada.calidad}</span>
          <span className="hidden sm:block sm:text-right">{es.portada.porTarea}</span>
        </div>
      </div>

      {tarjetas.length < 3 ? (
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

      <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
        {fuentes.join(" · ")} ·{" "}
        {usandoSemilla
          ? `instantánea del ${fechaDeLaSemilla}`
          : (hace(datos.actualizado) ?? es.estado.sinCorridas)}
      </p>
    </>
  );
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
