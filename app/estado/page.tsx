import { AvisoSemilla } from "@/components/aviso-semilla";
import { obtenerEstado, obtenerMetodologia } from "@/lib/datos";
import { es } from "@/lib/i18n/es";
import { hace } from "@/lib/tiempo";
import { cn } from "@/lib/utils";
import type { EstadoDelPipeline, Fuente, ResultadoDeFuente } from "@/lib/types";

export const metadata = { title: "Estado" };

const fecha = (ts: number) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(ts);

/**
 * Una web de datos que no enseña cuándo se actualizó por última vez está
 * pidiendo que se confíe a ciegas. Esta página existe para no tener que hacerlo.
 *
 * De ahí que cada fila diga lo que de verdad se sabe de esa fuente y no un
 * adorno: "listo · hace 12 s" y "falló · usando el 4 sep" son dos cosas
 * distintas, y la segunda es justo la que un sitio con menos vergüenza se
 * callaría.
 */
export default async function Estado() {
  const [{ fuentes }, estado] = await Promise.all([obtenerMetodologia(), obtenerEstado()]);

  const visibles = fuentes.filter((f) => f.activa);
  const corrida = estado?.ultimaCorrida ?? null;
  const enMarcha = corrida !== null && corrida.finishedAt === undefined;
  const leidas =
    corrida?.results.filter((r) => visibles.some((f) => f.id === r.sourceId)).length ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-[620px] flex-col gap-[22px] px-5 py-10 sm:px-[30px]">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-[30px] leading-[1.05] font-semibold tracking-[-0.03em]">
          Estado del pipeline
        </h1>
        <p className="text-pretty text-sm leading-[1.55] text-muted-foreground">
          El cron corre una vez al día a las 06:00 UTC. Cada fuente se descarga por separado: si
          una falla, las demás siguen y aquí se ve desde cuándo.
        </p>
      </div>

      <AvisoSemilla />

      {enMarcha ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-primary/30 bg-primary/[0.06] px-4 py-3.5">
          <span className="size-[9px] shrink-0 rounded-full bg-primary" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] leading-[1.3] font-medium">
              Actualizando ahora: {leidas} de {visibles.length} fuentes leídas
            </span>
            <span className="font-mono text-xs leading-[1.3] text-muted-foreground">
              empezó {hace(corrida.startedAt)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col overflow-hidden rounded-[10px] border">
        {visibles.map((f) => (
          <FilaDeFuente
            key={f.id}
            fuente={f}
            estado={estado}
            resultado={corrida?.results.find((r) => r.sourceId === f.id)}
            corridaEnMarcha={enMarcha}
          />
        ))}
      </div>

      {estado?.sinResolver.length ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-dashed px-4 py-3.5">
          <p className="text-pretty text-sm leading-[1.55]">{es.estado.sinResolver}</p>
          <p className="font-mono text-[11px] leading-[1.65] text-muted-foreground">
            {estado.sinResolver.slice(0, 4).map((u) => u.sourceKey).join(" · ")}
            {estado.sinResolver.length > 4
              ? ` · ${es.estado.sinResolverMas(estado.sinResolver.length - 4)}`
              : ""}
          </p>
        </div>
      ) : null}
    </main>
  );
}

function FilaDeFuente({
  fuente,
  estado,
  resultado,
  corridaEnMarcha,
}: {
  fuente: Fuente;
  estado: EstadoDelPipeline | null;
  resultado?: ResultadoDeFuente;
  corridaEnMarcha: boolean;
}) {
  const seguimiento = estado?.fuentes.find((s) => s.sourceId === fuente.id);
  const { texto, tono, detalle } = leer(fuente, seguimiento, resultado, corridaEnMarcha);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0",
        !fuente.activa && "opacity-55",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] leading-[1.2] font-medium">{fuente.nombre}</span>
        <span className="truncate font-mono text-[11.5px] leading-[1.2] text-muted-foreground">
          {fuente.id}
          {detalle ? ` · ${detalle}` : ""}
        </span>
      </div>
      <span className={cn("shrink-0 font-mono text-xs leading-[1.2]", tono)}>{texto}</span>
    </div>
  );
}

/** Qué se sabe de una fuente, en las palabras exactas que se pueden defender. */
function leer(
  fuente: Fuente,
  seguimiento: EstadoDelPipeline["fuentes"][number] | undefined,
  resultado: ResultadoDeFuente | undefined,
  corridaEnMarcha: boolean,
): { texto: string; tono: string; detalle?: string } {
  if (!fuente.activa) {
    return { texto: es.estado.apagada, tono: "text-muted-foreground", detalle: fuente.nota };
  }

  if (resultado?.status === "error") {
    const desde = seguimiento?.lastOkAt;
    return {
      texto: desde ? `${es.estado.fallo} · usando el ${fecha(desde)}` : es.estado.fallo,
      tono: "text-destructive",
      detalle: resultado.error,
    };
  }

  if (resultado?.status === "ok" || resultado?.status === "sin_cambios") {
    const cuando = hace(seguimiento?.lastOkAt ?? seguimiento?.lastRunAt);
    return {
      texto: cuando ? `${es.estado.listo} · ${cuando}` : es.estado.listo,
      tono: "text-ok",
      detalle:
        resultado.observations !== undefined
          ? `${resultado.observations} observaciones`
          : undefined,
    };
  }

  if (corridaEnMarcha) return { texto: es.estado.enCola, tono: "text-muted-foreground" };

  const cuando = hace(seguimiento?.lastOkAt);
  if (cuando) return { texto: `${es.estado.listo} · ${cuando}`, tono: "text-ok" };

  return { texto: es.estado.sinCorridas, tono: "text-muted-foreground" };
}
