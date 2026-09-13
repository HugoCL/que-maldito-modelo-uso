import Link from "next/link";
import { METRIC_CONFIG, METRICAS_ACTIVAS, PERFILES } from "@/convex/scoring/config";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { PerfilId } from "@/lib/types";

/**
 * Los filtros viven en la URL, no en el estado del componente.
 *
 * Así una recomendación filtrada se puede pegar en un chat y le llega igual a
 * quien la abra, el botón de atrás hace lo que debe, y el recálculo ocurre en
 * el servidor con los mismos datos y la misma función que la vista sin
 * filtrar. Un filtro que recorta en el cliente acabaría enseñando algo
 * distinto de lo que dice la metodología.
 *
 * Por eso cada opción es un enlace y no un botón: esto no necesita JavaScript
 * para funcionar, y lo que cambia la respuesta queda escrito en la barra de
 * direcciones. La explicación de cada perfil se enseña al pasar por encima con
 * CSS por lo mismo: un tooltip de librería convertiría la barra entera en un
 * componente de cliente para tres frases que ya están escritas.
 */

export type ParamsPortada = { perfil?: string; max?: string; abiertos?: string };

/** Los perfiles que existen, en el orden en que están escritos. */
export const PERFILES_VALIDOS = Object.keys(PERFILES) as PerfilId[];

const TECHOS = ["1", "3", "8", ""];

/** "a", "a y b", "a, b y c". */
const enumerar = (partes: string[]): string =>
  partes.length < 2 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;

/**
 * Qué benchmarks puntúan con el perfil elegido, con el nombre con el que se
 * publican. Sale del mismo sitio del que sale la nota, así que la frase no
 * puede quedarse diciendo algo que ya no es verdad.
 */
function benchmarksDelPerfil(perfil: PerfilId): string {
  const activas = METRICAS_ACTIVAS();
  const cuentan = (PERFILES[perfil].mide ?? activas).filter((m) => activas.includes(m));
  return enumerar(cuentan.map((m) => METRIC_CONFIG[m].label));
}

export function enlace(params: ParamsPortada, cambios: ParamsPortada): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries({ ...params, ...cambios })) {
    // "general" y "sin techo" son los valores por defecto: dejarlos fuera de
    // la URL hace que la portada sin filtros tenga una sola dirección.
    if (valor && valor !== "general") busqueda.set(clave, valor);
  }
  const qs = busqueda.toString();
  return qs ? `/?${qs}` : "/";
}

export function BarraDeFiltros({
  params,
  perfil,
  techo,
}: {
  params: ParamsPortada;
  perfil: PerfilId;
  techo: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4 sm:items-center sm:gap-y-2">
        <Grupo etiqueta={es.filtros.tarea}>
          {PERFILES_VALIDOS.map((id) => (
            <Opcion
              key={id}
              href={enlace(params, { perfil: id })}
              activa={perfil === id}
              ayuda={PERFILES[id].descripcion}
              ayudaId={`perfil-${id}`}
            >
              {PERFILES[id].corto}
            </Opcion>
          ))}
        </Grupo>

        <Grupo etiqueta={es.filtros.maxPorTarea}>
          {TECHOS.map((valor) => (
            <Opcion
              key={valor || "libre"}
              href={enlace(params, { max: valor })}
              activa={techo === valor}
              mono
            >
              {valor ? `$${valor}` : es.filtros.sinTechoCorto}
            </Opcion>
          ))}
        </Grupo>
      </div>

      {/* Los dos controles cambian cosas distintas y ninguna se ve en la propia
          pastilla: uno decide con qué se puntúa y el otro hasta dónde se
          gasta. Esta línea lo dice con los nombres de verdad. */}
      <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
        {[es.filtros.puntuaCon(benchmarksDelPerfil(perfil)), techo && es.filtros.conTope(techo)]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function Grupo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <span className="font-mono text-xs text-muted-foreground">{etiqueta}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Opcion({
  href,
  activa,
  mono,
  ayuda,
  ayudaId,
  children,
}: {
  href: string;
  activa: boolean;
  mono?: boolean;
  ayuda?: string;
  ayudaId?: string;
  children: React.ReactNode;
}) {
  const opcion = (
    <Link
      href={href}
      scroll={false}
      aria-current={activa ? "true" : undefined}
      aria-describedby={ayuda ? ayudaId : undefined}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 leading-none transition-colors",
        mono ? "font-mono text-[13px]" : "text-[12.5px]",
        activa
          ? "border-foreground bg-foreground font-medium text-background"
          : "border-border text-foreground/75 hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );

  if (!ayuda) return opcion;

  // La ayuda no se esconde con `display` ni con `visibility`: así sigue
  // existiendo para quien la escucha por el `aria-describedby`, y la ve quien
  // pasa el ratón o llega con el teclado.
  return (
    <span className="opcion">
      {opcion}
      <span id={ayudaId} role="tooltip" className="ayuda">
        {ayuda}
      </span>
    </span>
  );
}
