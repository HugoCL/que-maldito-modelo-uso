import { cookies } from "next/headers";
import { fetchQuery } from "convex/nextjs";
import { buttonVariants } from "@/components/ui/button";
import { EFFORTS } from "@/convex/schema";
import { METRICAS_ACTIVAS, METRIC_CONFIG } from "@/convex/scoring/config";
import type { EstadoDelPreliminar } from "@/convex/scoring/preliminares";
import { cn } from "@/lib/utils";
import { borrar, entrar, guardar, salir } from "./acciones";
import { COOKIE, funciones } from "./conexion";

/**
 * Carga a mano de los resultados que publica un laboratorio el día que lanza un
 * modelo, antes de que los benchmarks lo midan.
 *
 * No la enlaza ninguna página y no se indexa. La guarda `REFRESCO_TOKEN`, el
 * mismo secreto de `/api/refrescar`, y quien decide si vale es Convex.
 */
export const metadata = {
  title: "Preliminares",
  robots: { index: false, follow: false },
};

type Fila = {
  id: string;
  modelKey: string;
  modelName?: string;
  effort: string;
  metric: keyof typeof METRIC_CONFIG;
  value: number;
  fuenteUrl?: string;
  measuredAt?: string;
  situacion: EstadoDelPreliminar;
};

type Listado =
  | { estado: "apagada" }
  | { estado: "denegada" }
  | {
      estado: "ok";
      preliminares: Fila[];
      modelos: Array<{ modelKey: string; name: string; releaseDate?: string }>;
    };

const CAMPO =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
const ETIQUETA = "flex flex-col gap-1.5 text-[13px] font-medium";

export default async function Preliminares({
  searchParams,
}: PageProps<"/admin/preliminares">) {
  const { ok, error } = (await searchParams) as { ok?: string; error?: string };

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <Marco>
        <p className="text-sm text-muted-foreground">
          Esta web corre sin Convex: no hay dónde guardar nada.
        </p>
      </Marco>
    );
  }

  const token = (await cookies()).get(COOKIE)?.value ?? "";
  const res = (await fetchQuery(funciones.listar, { token })) as Listado;

  if (res.estado === "apagada") {
    return (
      <Marco>
        <p className="text-sm leading-[1.55] text-muted-foreground">
          Está apagada: falta <code className="font-mono">REFRESCO_TOKEN</code> en las variables de
          entorno de Convex, o tiene menos de 24 caracteres.
        </p>
      </Marco>
    );
  }

  if (res.estado === "denegada") {
    return (
      <Marco aviso={{ error: token ? "El token guardado ya no vale." : error }}>
        <form action={entrar} className="flex flex-col gap-3">
          <label className={ETIQUETA}>
            Token
            <input
              name="token"
              type="password"
              autoComplete="current-password"
              required
              className={CAMPO}
            />
          </label>
          <button type="submit" className={cn(buttonVariants(), "self-start")}>
            Entrar
          </button>
        </form>
      </Marco>
    );
  }

  const metricas = METRICAS_ACTIVAS();

  return (
    <Marco aviso={{ ok, error }}>
      <form action={guardar} className="flex flex-col gap-4 rounded-[10px] border px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <label className={ETIQUETA}>
            Modelo
            <input
              name="modelo"
              list="modelos"
              required
              placeholder="claude-opus-5-5, o el nombre"
              className={CAMPO}
            />
            <datalist id="modelos">
              {res.modelos.map((m) => (
                <option key={m.modelKey} value={m.modelKey}>
                  {m.name}
                </option>
              ))}
            </datalist>
          </label>
          <label className={ETIQUETA}>
            Effort
            <select name="effort" defaultValue="default" className={CAMPO}>
              {EFFORTS.map((e) => (
                <option key={e} value={e}>
                  {e === "default" ? "sin effort" : e}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {metricas.map((m) => (
            <label key={m} className={ETIQUETA}>
              {METRIC_CONFIG[m].label}
              <input
                name={m}
                inputMode="decimal"
                placeholder="%"
                className={cn(CAMPO, "font-mono tabular-nums")}
              />
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <label className={ETIQUETA}>
            Fuente
            <input name="fuenteUrl" type="url" placeholder="https://…" className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            Fecha del dato
            <input name="measuredAt" type="date" className={CAMPO} />
          </label>
        </div>

        <p className="text-pretty text-[12.5px] leading-[1.5] text-muted-foreground">
          Los benchmarks en blanco no se tocan. Volver a cargar el mismo modelo, effort y benchmark
          corrige el número. Cuando el benchmark publique su propio resultado, ese sobrescribe al
          preliminar solo.
        </p>

        <button type="submit" className={cn(buttonVariants(), "self-start")}>
          Guardar
        </button>
      </form>

      {res.preliminares.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ningún preliminar.</p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead className="bg-muted/40 font-mono text-[11px] text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-normal">Modelo</th>
                <th className="px-3 py-2 font-normal">Benchmark</th>
                <th className="px-3 py-2 text-right font-normal">Valor</th>
                <th className="px-3 py-2 font-normal">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {res.preliminares.map((p) => (
                <tr key={p.id} className="border-t border-border align-baseline">
                  <td className="px-3 py-2">
                    <span className="block">{p.modelName ?? p.modelKey}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {p.effort === "default" ? "sin effort" : p.effort}
                      {p.measuredAt ? ` · ${p.measuredAt}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {p.fuenteUrl ? (
                      <a
                        href={p.fuenteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        {METRIC_CONFIG[p.metric]?.label ?? p.metric}
                      </a>
                    ) : (
                      (METRIC_CONFIG[p.metric]?.label ?? p.metric)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {(p.value * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <Situacion s={p.situacion} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={borrar}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className={buttonVariants({ variant: "ghost", size: "xs" })}
                      >
                        Borrar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={salir}>
        <button type="submit" className={buttonVariants({ variant: "link", size: "xs" })}>
          Salir
        </button>
      </form>
    </Marco>
  );
}

function Situacion({ s }: { s: EstadoDelPreliminar }) {
  switch (s.tipo) {
    case "cuenta":
      return <span className="text-foreground">cuenta</span>;
    case "reemplazado":
      return (
        <span className="text-muted-foreground">
          sobrescrito por el oficial{s.porEffort !== "default" ? ` (${s.porEffort})` : ""}
        </span>
      );
    case "sin_modelo":
      return <span className="text-muted-foreground">esperando al catálogo</span>;
  }
}

function Marco({
  aviso,
  children,
}: {
  aviso?: { ok?: string; error?: string };
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-[22px] px-5 py-10 sm:px-[30px]">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-[30px] leading-[1.05] font-semibold tracking-[-0.03em]">
          Valores preliminares
        </h1>
        <p className="text-pretty text-sm leading-[1.55] text-muted-foreground">
          Lo que publica el laboratorio al lanzar un modelo, para que cuente mientras los
          benchmarks no lo miden. En la web sale marcado como preliminar.
        </p>
      </div>
      {aviso?.error ? (
        <p className="rounded-[10px] border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-[13.5px]">
          {aviso.error}
        </p>
      ) : aviso?.ok ? (
        <p className="rounded-[10px] border border-primary/30 bg-primary/[0.06] px-4 py-3 text-[13.5px]">
          {aviso.ok}
        </p>
      ) : null}
      {children}
    </main>
  );
}
