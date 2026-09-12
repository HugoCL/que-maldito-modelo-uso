import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BarraDeCalidad } from "@/components/barra-de-calidad";
import { clavesDeModeloEnLaSemilla, obtenerModelo } from "@/lib/datos";
import { es } from "@/lib/i18n/es";

export async function generateStaticParams() {
  return clavesDeModeloEnLaSemilla().map((modelKey) => ({ modelKey }));
}

export async function generateMetadata({ params }: PageProps<"/modelo/[modelKey]">) {
  const { modelKey } = await params;
  const m = await obtenerModelo(modelKey);
  return { title: m ? m.name : "Modelo" };
}

const numero = (n: number) => new Intl.NumberFormat("es").format(n);

export default async function FichaModelo({ params }: PageProps<"/modelo/[modelKey]">) {
  const { modelKey } = await params;
  const m = await obtenerModelo(modelKey);
  if (!m) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-5 py-12">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {es.generico.volver}
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">{m.name}</h1>
        <p className="text-muted-foreground">{m.creator}</p>
        {m.description ? <p className="max-w-2xl text-pretty">{m.description}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {m.openWeights ? <Badge variant="secondary">{es.tarjeta.pesosAbiertos}</Badge> : null}
          {m.programmingRank ? (
            <Badge variant="outline" className="font-mono">
              #{m.programmingRank} en uso para programar (OpenRouter)
            </Badge>
          ) : null}
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Precios de lista</CardTitle>
            <CardDescription>USD {es.generico.porMillon}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 text-sm">
              <Fila etiqueta={es.generico.entrada} valor={precio(m.pricing?.input)} />
              <Fila etiqueta="Salida" valor={precio(m.pricing?.output)} />
              <Fila etiqueta={es.generico.cacheLectura} valor={precio(m.pricing?.cacheRead)} />
              <Fila etiqueta="Escritura de caché" valor={precio(m.pricing?.cacheWrite)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ficha técnica</CardTitle>
            <CardDescription>Según models.dev</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 text-sm">
              <Fila
                etiqueta={es.generico.contexto}
                valor={m.contextLimit ? `${numero(m.contextLimit)} tokens` : "—"}
              />
              <Fila
                etiqueta={es.generico.salida}
                valor={m.outputLimit ? `${numero(m.outputLimit)} tokens` : "—"}
              />
              <Fila etiqueta={es.generico.publicado} valor={m.releaseDate ?? "—"} />
              <Fila etiqueta={es.generico.corte} valor={m.knowledgeCutoff ?? "—"} />
            </dl>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-semibold">Por nivel de effort</h2>
          <p className="text-sm text-muted-foreground">
            Subir el effort compra calidad y cuesta dinero. Aquí se ve exactamente cuánto de cada
            cosa, que es la decisión que casi nadie toma a propósito.
          </p>
        </div>

        {m.variantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún benchmark de los que seguimos ha medido este modelo todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {m.variantes.map((v) => (
              <div key={v.variantKey} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-mono text-sm">
                    {v.effort === "default" ? es.tarjeta.sinEffort : v.effort}
                  </p>
                  <div className="flex items-baseline gap-5 font-mono text-sm tabular-nums">
                    <span>
                      <span className="text-muted-foreground">calidad </span>
                      {v.quality.toFixed(1)}
                    </span>
                    <span>
                      <span className="text-muted-foreground">costo </span>
                      {v.cost !== undefined ? `$${v.cost.toFixed(2)}` : "—"}
                    </span>
                  </div>
                </div>
                <BarraDeCalidad
                  valor={v.quality}
                  lo={v.qualityLo}
                  hi={v.qualityHi}
                  className="mt-3"
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {v.metricas.map((met) => (
                    <Badge key={met.metric} variant="outline" className="font-mono text-[11px]">
                      {met.etiqueta} {met.valor.toFixed(1)}%
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {m.providers.length ? (
        <section className="flex flex-col gap-3">
          <Separator />
          <h2 className="font-heading text-sm font-semibold">{es.tarjeta.disponibleEn}</h2>
          <p className="font-mono text-xs text-muted-foreground">{m.providers.join(" · ")}</p>
        </section>
      ) : null}
    </main>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="font-mono tabular-nums">{valor}</dd>
    </div>
  );
}

const precio = (n?: number) => (n === undefined ? "—" : `$${n.toFixed(2)}`);
