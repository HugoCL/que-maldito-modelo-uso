import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerModelo, obtenerRecomendaciones } from "@/lib/datos";
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

/**
 * La ficha contesta una sola pregunta: qué compra cada nivel de effort.
 *
 * Por eso la tabla de efforts va primero y el resto (precios de lista,
 * contexto, fecha) queda debajo en una lista de filas. Subir el effort es la
 * decisión que casi nadie toma a propósito y la única que esta página puede
 * cambiar.
 */
export default async function FichaModelo({ params }: PageProps<"/modelo/[modelKey]">) {
  const { modelKey } = await params;
  const [m, datos] = await Promise.all([obtenerModelo(modelKey), obtenerRecomendaciones()]);
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
  const conDesglose = [...m.variantes].sort((a, b) => b.quality - a.quality)[0];

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
                  ganadores.has(v.variantKey) && "border-l-[3px] border-l-primary",
                )}
              >
                <span>{v.effort === "default" ? es.tarjeta.sinEffort : v.effort}</span>
                <span className="text-right">{v.quality.toFixed(1)}</span>
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

      {m.variantes.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-5">
          <span className="text-[13px] font-medium">
            {es.tarjeta.medidoPor}
            {conDesglose.effort !== "default" ? (
              <span className="ml-1.5 font-mono text-[11.5px] font-normal text-muted-foreground">
                {conDesglose.effort}
              </span>
            ) : null}
          </span>
          <div className="flex flex-col gap-1.5 font-mono text-[12px]">
            {conDesglose.metricas.map((met) => (
              <div key={met.metric} className="flex items-baseline justify-between gap-4">
                <span className="text-foreground/75">{met.etiqueta}</span>
                {/* Sin el peso al lado: todos los benchmarks valen lo mismo,
                    así que repetirlo en cada fila solo añade un número que no
                    distingue nada. Se explica una vez en /metodologia. */}
                <span className="text-muted-foreground tabular-nums">{met.valor.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
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
