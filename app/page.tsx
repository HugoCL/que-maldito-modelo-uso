import { Suspense } from "react";
import Link from "next/link";
import { AvisoSemilla } from "@/components/aviso-semilla";
import {
  BarraDeFiltros,
  PERFILES_VALIDOS,
  enlace,
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
  usandoSemilla,
} from "@/lib/datos";
import { es } from "@/lib/i18n/es";
import { hace } from "@/lib/tiempo";
import type { PerfilId } from "@/lib/types";

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<ParamsPortada>;
}) {
  const params = await searchParams;
  const perfil = PERFILES_VALIDOS.includes(params.perfil as PerfilId)
    ? (params.perfil as PerfilId)
    : "general";

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

      <BarraDeFiltros params={params} perfil={perfil} techo={params.max ?? ""} />

      <Suspense key={JSON.stringify(params)} fallback={<Esqueleto />}>
        <Respuestas perfil={perfil} params={params} />
      </Suspense>
    </main>
  );
}

async function Respuestas({ perfil, params }: { perfil: PerfilId; params: ParamsPortada }) {
  const techo = params.max ? Number(params.max) : undefined;
  const soloAbiertos = params.abiertos === "1";
  const hayFiltros = techo !== undefined || soloAbiertos;

  // Dos respuestas y no una: la de arriba es la que contesta con los filtros
  // puestos, y la de abajo, siempre sin filtrar, es la que le da al gráfico la
  // frontera entera. El techo vela lo que descarta en vez de borrarlo: un
  // filtro que esconde lo que quita deja sin saber a qué se está renunciando.
  const [sinFiltrar, filtrada, metodologia] = await Promise.all([
    obtenerRecomendaciones(perfil),
    hayFiltros
      ? obtenerRecomendaciones(perfil, {
          presupuestoMax: techo,
          soloOpenWeights: soloAbiertos || undefined,
        })
      : undefined,
    obtenerMetodologia(),
  ]);

  const datos = filtrada ?? sinFiltrar;
  const tarjetas = datos.tarjetas;
  const frontera = sinFiltrar.frontera;

  if (tarjetas.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-[10px] border border-dashed px-5 py-8 text-center">
        <p className="font-heading text-lg font-semibold">{es.vacio.titulo}</p>
        <p className="mx-auto max-w-md text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {es.vacio.descripcion}
        </p>
        {/* Quita las dos restricciones, no el perfil: el tipo de tarea cambia
            los pesos, nunca deja fuera a nadie, así que no puede ser la causa
            de que no quede ninguna respuesta. */}
        <Link
          href={enlace(params, { max: "", abiertos: "" })}
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
  const activas = metodologia.fuentes.filter((f) => f.activa);
  const fuentes = [
    ...activas.filter((f) => f.tipo === "benchmark"),
    ...activas.filter((f) => f.tipo === "catalogo").slice(0, 1),
  ].map((f) => f.nombre);

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-[10px] border">
        {tarjetas.map((t) => (
          <FilaRecomendacion key={t.tier} tarjeta={t} />
        ))}

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t bg-muted/40 px-4 py-[11px] font-mono text-[11.5px] text-muted-foreground sm:grid sm:grid-cols-[150px_minmax(0,1fr)_90px_96px] sm:gap-6 sm:px-[22px]">
          <span className="hidden sm:block" />
          <span>{es.portada.pieDeTabla(metodologia.metricas.length)}</span>
          <span className="hidden sm:block sm:text-right">{es.portada.calidad}</span>
          <span className="hidden sm:block sm:text-right">{es.portada.porTarea}</span>
        </div>
      </div>

      {tarjetas.length < 3 ? (
        <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
          {es.portada.faltanRespuestas}
        </p>
      ) : null}

      <FronteraCalidadCosto
        variantes={frontera}
        tarjetas={tarjetas}
        techo={techo}
        enFrontera={sinFiltrar.totales.enFrontera}
      />

      <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
        {fuentes.join(" · ")} ·{" "}
        {usandoSemilla
          ? `instantánea del ${fechaDeLaSemilla}`
          : (hace(datos.actualizado) ?? es.estado.sinCorridas)}
      </p>
    </>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-[30px]">
      <Skeleton className="h-[18rem] w-full rounded-[10px]" />
      <Skeleton className="h-[196px] w-full rounded-[10px]" />
    </div>
  );
}
