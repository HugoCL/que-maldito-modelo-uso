import Link from "next/link";
import { notFound } from "next/navigation";
import { fuentesApagadas } from "@/components/barra-de-filtros";
import { CuentaDeLaNota } from "@/components/cuenta-de-la-nota";
import { obtenerEscala, obtenerModelo, obtenerRecomendaciones } from "@/lib/datos";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { Tier, Variante } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/modelo/[modelKey]">) {
  const { modelKey } = await params;
  const m = await obtenerModelo(modelKey);
  return { title: m ? m.name : "Modelo" };
}

const numero = (n: number) => new Intl.NumberFormat("es").format(n);
const precio = (n?: number) => (n === undefined ? "—" : `$${n.toFixed(2)}`);
/** El mismo formato que usa /metodologia para esta corrección. */
const conSigno = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

/** Una línea por columna del desglose, en el orden en el que se leen. */
const COLUMNAS = [
  [es.desglose.publica, es.desglose.columnas.publica],
  [es.desglose.enLaEscala, es.desglose.columnas.enLaEscala],
  [es.desglose.ajuste, es.desglose.columnas.ajuste],
  [es.desglose.nivelado, es.desglose.columnas.nivelado],
] as const;

/** El mismo color de cada respuesta que en la portada. Ver fila-recomendacion.tsx. */
const BARRA: Record<Tier, string> = {
  barato: "border-l-tier-barato",
  dia_a_dia: "border-l-tier-dia",
  bueno: "border-l-tier-bueno",
};

/** Las cinco columnas del desglose: el benchmark y sus cuatro pasos. */
const CUADRICULA = "grid grid-cols-[minmax(0,1fr)_52px_46px_52px_52px] items-baseline gap-x-2";

/**
 * La ficha contesta una sola pregunta: qué compra cada nivel de effort.
 *
 * Por eso la tabla de efforts va primero y el resto (precios de lista,
 * contexto, fecha) queda debajo en una lista de filas. Subir el effort es la
 * decisión que casi nadie toma a propósito y la única que esta página puede
 * cambiar.
 */
export default async function FichaModelo({
  params,
  searchParams,
}: PageProps<"/modelo/[modelKey]">) {
  const { modelKey } = await params;
  // Las fuentes apagadas llegan desde la portada en la URL: la ficha tiene que
  // puntuar con lo mismo con lo que se puntuó la recomendación que trajo aquí.
  const sin = fuentesApagadas((await searchParams).sin as string | undefined);
  // La escala va con el mismo `sin`: apagar una fuente mueve el centro y los
  // extremos, y el desglose los enseña para que la cuenta cierre.
  const [m, datos, escala] = await Promise.all([
    obtenerModelo(modelKey, sin),
    obtenerRecomendaciones({ sin }),
    obtenerEscala(sin),
  ]);
  if (!m) notFound();

  // El único acento de la página: el effort que hoy gana una de las tres
  // respuestas de la portada. Si este modelo no gana ninguna, no hay acento.
  const ganadores = new Map<string, Tier>(
    datos.tarjetas.map((t) => [t.ganador.variantKey, t.tier]),
  );

  // De menos a más caro: la tabla se lee como una escalera de "y si pago un
  // poco más", que es el orden en el que se toma esta decisión.
  const ordenadas = [...m.variantes].sort(
    (a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity) || a.quality - b.quality,
  );
  const salto = saltoFinal(ordenadas.filter((v) => v.cost !== undefined));

  // El desglose sigue el mismo orden que la tabla de efforts para que las dos
  // se lean en paralelo: la de arriba dice cuánto saca cada nivel, esta de
  // dónde sale ese número.
  const conDesglose = ordenadas.filter((v) => v.metricas.length > 0);

  // Lo que el globo de cada nota necesita del conjunto y no de este modelo.
  const deLaEscala = {
    k: escala.k,
    centroNivelado: escala.centroNivelado,
    extremos: escala.extremos,
  };

  // Los extremos de normalización son del conjunto entero, así que no cambian
  // entre variantes: se dicen una vez debajo de la tabla en lugar de repetirse
  // en cada fila.
  const escalas = [...new Map(conDesglose.flatMap((v) => v.metricas).map((m) => [m.metric, m])).values()]
    .map((m) =>
      es.desglose.escala(m.etiqueta, `${m.minimo.toFixed(1)}%`, `${m.maximo.toFixed(1)}%`),
    )
    .join("; ");

  return (
    <main className="mx-auto flex w-full max-w-[620px] flex-col gap-[26px] px-5 py-10 sm:px-[30px]">
      <Link
        href="/"
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        ← {es.generico.volver.toLowerCase()}
      </Link>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">{m.creator}</span>
        <h1 className="font-heading text-[30px] leading-[1.05] font-semibold tracking-[-0.03em]">
          {m.name}
        </h1>
      </div>

      {m.variantes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{es.generico.sinMedir}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col overflow-hidden rounded-[10px] border">
            <div className="grid grid-cols-[1fr_70px_78px] gap-3 bg-muted/40 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
              <span>{es.generico.effort}</span>
              <span className="text-right">{es.portada.calidad}</span>
              <span className="text-right">{es.portada.porTarea}</span>
            </div>
            {ordenadas.map((v) => (
              <div
                key={v.variantKey}
                className={cn(
                  "grid grid-cols-[1fr_70px_78px] gap-3 border-t border-border px-4 py-3 font-mono text-[13.5px] leading-[1.3] tabular-nums",
                  ganadores.has(v.variantKey) && ["border-l-[3px]", BARRA[ganadores.get(v.variantKey)!]],
                )}
              >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  {v.effort === "default" ? es.tarjeta.sinEffort : v.effort}
                  {/* La barra sola no decía nada: ahora dice qué respuesta es. */}
                  {ganadores.has(v.variantKey) ? (
                    <span className="text-[11px] text-muted-foreground">
                      {es.ficha.ganaA(es.tiers[ganadores.get(v.variantKey)!])}
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  <CuentaDeLaNota variante={v} escala={deLaEscala}>
                    {v.quality.toFixed(1)}
                  </CuentaDeLaNota>
                </span>
                <span className="text-right">{precio(v.cost)}</span>
              </div>
            ))}
          </div>
          {salto ? (
            <p className="text-[13px] leading-[1.5] text-muted-foreground">{salto}</p>
          ) : null}
        </div>
      )}

      <dl className="flex flex-col gap-[9px] border-t pt-5 text-[13px] leading-[1.3]">
        <Fila
          etiqueta={es.generico.entradaSalida}
          valor={`${precio(m.pricing?.input)} / ${precio(m.pricing?.output)}`}
        />
        <Fila etiqueta={es.generico.cacheLectura} valor={precio(m.pricing?.cacheRead)} />
        <Fila
          etiqueta={es.generico.contexto}
          valor={m.contextLimit ? numero(m.contextLimit) : "—"}
        />
        <Fila
          etiqueta={es.generico.salida}
          valor={m.outputLimit ? numero(m.outputLimit) : "—"}
        />
        <Fila etiqueta={es.generico.publicado} valor={m.releaseDate ?? "—"} />
        <Fila etiqueta={es.generico.corte} valor={m.knowledgeCutoff ?? "—"} />
        {m.openWeights ? <Fila etiqueta={es.tarjeta.pesosAbiertos} valor="sí" /> : null}
      </dl>

      {conDesglose.length > 0 ? (
        // Plegado: es la cuenta para quien quiere rehacerla a mano, y abierto
        // ocupaba dos tercios de la ficha. El globo de cada nota de arriba
        // sigue enseñando la operación sin abrir nada.
        <details className="group border-t pt-5">
          <summary className="w-fit cursor-pointer list-none text-[13px] font-medium [&::-webkit-details-marker]:hidden">
            <span className="mr-1.5 inline-block text-muted-foreground transition-transform group-open:rotate-90">›</span>
            {es.desglose.titulo}
          </summary>
          <div className="mt-2.5 flex flex-col gap-2.5">

            {/* Una por effort, en el mismo orden que la tabla de arriba: la
                pregunta de esta página es qué compra subir de nivel, y explicar
                solo una de las cinco notas deja las otras cuatro en un número
                que hay que creerse.

                Cuatro columnas por benchmark, que son los cuatro pasos: lo
                que publica, ese resultado en la escala de 0 a 100, el ajuste que
                le toca por el desnivel de su fuente y lo que queda, que es lo
                único que se promedia. El ajuste se enseña con su signo y ya
                cambiado de sentido: es el número que hay que sumarle a la columna
                de al lado, porque el sentido de esta tabla es poder rehacerla a
                mano. Esconderlo dejaría la media sin cuadrar. El peso no va en la
                fila porque todos valen lo mismo.

                En una columna estrecha la tabla se desplaza en horizontal en vez
                de apretar cinco columnas hasta que no se lea ninguna. */}
            <div className="overflow-x-auto rounded-[10px] border">
              <div className="flex min-w-[420px] flex-col font-mono text-[12px]">
                <div className={cn(CUADRICULA, "bg-muted/40 px-3.5 py-2 text-[11px] text-muted-foreground")}>
                  <span />
                  <span className="text-right">{es.desglose.publica}</span>
                  <span className="text-right">{es.desglose.enLaEscala}</span>
                  <span className="text-right">{es.desglose.ajuste}</span>
                  <span className="text-right">{es.desglose.nivelado}</span>
                </div>
                {conDesglose.map((v) => (
                  <div key={v.variantKey} className="border-t border-border">
                    <div className={cn(CUADRICULA, "bg-muted/40 px-3.5 py-2")}>
                      <span className="min-w-0 truncate">
                        {v.effort === "default" ? es.tarjeta.sinEffort : v.effort}
                      </span>
                      <span className="col-span-4 text-right tabular-nums">
                        <span className="text-muted-foreground">{es.desglose.calidad} </span>
                        <CuentaDeLaNota variante={v} escala={deLaEscala} className="font-medium">
                          {v.quality.toFixed(1)}
                        </CuentaDeLaNota>
                      </span>
                    </div>
                    {v.metricas.map((met) => (
                      <div
                        key={met.metric}
                        className={cn(CUADRICULA, "px-3.5 py-[7px] text-muted-foreground")}
                      >
                        <span className="min-w-0 truncate">{met.etiqueta}</span>
                        <span className="text-right tabular-nums">{met.valor.toFixed(1)}%</span>
                        {/* Con un decimal y no redondeado a entero: la gracia de
                            esto es poder rehacer la media a mano, y 100 + 99 da
                            99.5 cuando la nota dice 99.7. */}
                        <span className="text-right tabular-nums">{met.normalizado.toFixed(1)}</span>
                        <span className="text-right tabular-nums">
                          {met.desnivel === 0 ? "—" : conSigno(-met.desnivel)}
                        </span>
                        <span className="text-right tabular-nums text-foreground/75">
                          {(met.normalizado - met.desnivel).toFixed(1)}
                        </span>
                      </div>
                    ))}
                    {/* Aire debajo del último benchmark: aquí acababan las dos
                        filas de la media, y sin nada el grupo quedaba pegado al
                        siguiente. */}
                    <div className="pb-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Una línea por columna y en su mismo orden, en vez del párrafo
                corrido de antes: cada frase queda al lado del número que explica,
                y el nombre de la columna es el que se lee en la cabecera. */}
            <dl className="flex flex-col gap-1.5 pt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
              {COLUMNAS.map(([nombre, texto]) => (
                <div key={nombre} className="flex gap-2.5">
                  <dt className="w-[58px] shrink-0 font-mono text-[11px] leading-[1.6] text-foreground/70">
                    {nombre}
                  </dt>
                  <dd className="min-w-0 text-pretty">{texto}</dd>
                </div>
              ))}
            </dl>

            {/* La tabla llega hasta la columna nivelada y ahí se para. Lo que
                viene después cuelga de cada nota, que es donde se pregunta; aquí
                solo se dice que está ahí y se enlaza el porqué del centro. */}
            <p className="text-pretty text-[12.5px] leading-[1.5] text-muted-foreground">
              {es.desglose.dondeEstaLaCuenta}{" "}
              <Link
                href="/metodologia#evidencia"
                className="underline underline-offset-4 hover:text-foreground"
              >
                {es.desglose.losDosPasos}
              </Link>
              {conDesglose.some((v) => v.metricas.length < 2)
                ? ` ${es.desglose.unSoloBenchmark}`
                : ""}
            </p>

            <p className="text-pretty text-[12.5px] leading-[1.5] text-muted-foreground">
              {es.desglose.escalas(escalas)}
            </p>
          </div>
        </details>
      ) : null}

      {m.providers.length ? (
        <div className="flex flex-col gap-2 border-t pt-5">
          <span className="text-[13px] font-medium">{es.tarjeta.disponibleEn}</span>
          <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
            {m.providers.join(" · ")}
          </p>
        </div>
      ) : null}
    </main>
  );
}

/**
 * El último escalón de effort es el que peor relación tiene casi siempre, y es
 * el que nadie mira antes de dejarlo puesto. Se escribe aparte, en una frase.
 */
function saltoFinal(porCosto: Variante[]): string | null {
  if (porCosto.length < 2) return null;
  const [antes, despues] = porCosto.slice(-2);
  if (antes.effort === "default" || despues.effort === "default") return null;

  const calidad = despues.quality - antes.quality;
  const coste = despues.cost! - antes.cost!;
  if (coste <= 0) return null;

  return `De ${antes.effort} a ${despues.effort}: ${calidad >= 0 ? "+" : ""}${calidad.toFixed(
    1,
  )} de calidad por $${coste.toFixed(2)} más.`;
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="font-mono tabular-nums">{valor}</dd>
    </div>
  );
}
