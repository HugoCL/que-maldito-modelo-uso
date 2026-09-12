import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AvisoSemilla } from "@/components/aviso-semilla";
import { BarraDeFiltros } from "@/components/barra-de-filtros";
import { FronteraCalidadCosto } from "@/components/frontera-calidad-costo";
import { TarjetaRecomendacion } from "@/components/tarjeta-recomendacion";
import { obtenerRecomendaciones } from "@/lib/datos";
import { es } from "@/lib/i18n/es";
import type { PerfilId } from "@/lib/types";

const PERFILES_VALIDOS: PerfilId[] = ["general", "mantenimiento", "agentico", "greenfield"];

type Params = { perfil?: string; max?: string; abiertos?: string };

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const perfil = PERFILES_VALIDOS.includes(params.perfil as PerfilId)
    ? (params.perfil as PerfilId)
    : "general";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-12 sm:py-16">
      <section className="flex flex-col gap-4">
        <h1 className="max-w-3xl text-balance font-heading text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
          {es.marca.nombre}
        </h1>
        <p className="max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          {es.marca.lema}
        </p>
      </section>

      <AvisoSemilla />

      <Suspense fallback={<EsqueletoFiltros />}>
        <BarraDeFiltros />
      </Suspense>

      <Suspense key={JSON.stringify(params)} fallback={<EsqueletoTarjetas />}>
        <Respuestas perfil={perfil} params={params} />
      </Suspense>
    </main>
  );
}

async function Respuestas({ perfil, params }: { perfil: PerfilId; params: Params }) {
  const datos = await obtenerRecomendaciones(perfil);

  // El filtrado por presupuesto y pesos abiertos se aplica sobre el resultado
  // ya puntuado. Convex lo hace en el servidor sobre el conjunto completo; en
  // modo semilla se recorta aquí sobre la frontera guardada.
  const techo = params.max ? Number(params.max) : undefined;
  const soloAbiertos = params.abiertos === "1";
  const pasa = (coste?: number, abierto?: boolean) =>
    (techo === undefined || (coste ?? Infinity) <= techo) && (!soloAbiertos || !!abierto);

  const tarjetas = datos.tarjetas.filter((t) => pasa(t.ganador.cost, t.ganador.openWeights));
  const frontera = datos.frontera.filter((v) => pasa(v.cost, v.openWeights));

  if (tarjetas.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{es.vacio.titulo}</EmptyTitle>
          <EmptyDescription>{es.vacio.descripcion}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-5 lg:grid-cols-3">
        {tarjetas.map((t) => (
          <TarjetaRecomendacion key={t.tier} tarjeta={t} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono">
          {datos.totales.candidatos} variantes
        </Badge>
        <Badge variant="outline" className="font-mono">
          {datos.totales.elegibles} con datos suficientes
        </Badge>
        <Badge variant="outline" className="font-mono">
          {frontera.length} en la frontera
        </Badge>
        <span>
          Una variante es un modelo a un nivel de reasoning effort: &ldquo;Opus 5 en medium&rdquo; y
          &ldquo;Opus 5 en max&rdquo; no cuestan ni rinden lo mismo.
        </span>
      </div>

      {frontera.length > 1 ? (
        <FronteraCalidadCosto variantes={frontera} tarjetas={tarjetas} />
      ) : null}
    </div>
  );
}

function EsqueletoFiltros() {
  return <Skeleton className="h-44 w-full rounded-xl" />;
}

function EsqueletoTarjetas() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[26rem] w-full rounded-xl" />
      ))}
    </div>
  );
}
