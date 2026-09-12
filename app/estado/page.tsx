import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AvisoSemilla } from "@/components/aviso-semilla";
import { obtenerMetodologia, usandoSemilla } from "@/lib/datos";

export const metadata = { title: "Estado" };

/**
 * Una web de datos que no enseña cuándo se actualizó por última vez está
 * pidiendo que se confíe a ciegas. Esta página existe para no tener que hacerlo.
 */
export default async function Estado() {
  const { fuentes } = await obtenerMetodologia();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">Estado del pipeline</h1>
        <p className="text-pretty text-muted-foreground">
          El cron corre una vez al día a las 06:00 UTC. Cada fuente se descarga por separado: si
          una falla, las demás siguen y aquí se ve desde cuándo.
        </p>
      </header>

      <AvisoSemilla />

      <section className="flex flex-col gap-4">
        <Separator />
        <h2 className="font-heading text-lg font-semibold">Fuentes</h2>
        <ul className="flex flex-col gap-3">
          {fuentes.map((f) => (
            <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{f.nombre}</span>
                <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
              </div>
              <Badge variant={f.activa ? "secondary" : "outline"}>
                {f.activa ? "activa" : "apagada"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {usandoSemilla ? null : (
        <section className="flex flex-col gap-3">
          <Separator />
          <h2 className="font-heading text-lg font-semibold">Últimas corridas</h2>
          <p className="text-sm text-muted-foreground">
            El detalle por corrida —qué fuente cambió, cuántas observaciones entraron y qué nombres
            quedaron sin resolver— vive en la tabla <code className="font-mono">ingestRuns</code> de
            Convex y se consulta con{" "}
            <code className="font-mono">npx convex run ingest/runs:estado</code>.
          </p>
        </section>
      )}
    </main>
  );
}
