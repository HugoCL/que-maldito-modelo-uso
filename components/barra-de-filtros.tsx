import Link from "next/link";
import {
  esFamilia,
  IDS_FAMILIA,
  modelosOcultos,
  type IdFamilia,
  type ModeloEnLista,
} from "@/convex/scoring/filtros";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { Metodologia } from "@/lib/types";
import { CopiarEnlace } from "./copiar-enlace";
import { ListaOcultar } from "./lista-ocultar";
import { enlace, type ParamsPortada } from "./params-portada";

export type { ParamsPortada };
export { enlace };

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
 * direcciones. La lista de modelos es la excepción: checked significa que
 * entra en la evaluación, y un GET nativo solo manda los marcados, así que
 * aplicar arma `ocultos` en el cliente con los desmarcados. El enlace
 * compartido sigue corto. La explicación del sesgo se enseña al pasar por
 * encima con CSS por lo mismo: un tooltip de librería convertiría la barra
 * entera en un componente de cliente para una frase que ya está escrita.
 *
 * Aquí hubo un tercer control, el tipo de tarea, que decidía qué benchmarks
 * contaban según el trabajo que fueras a hacer. Se quitó porque esa asignación
 * no se podía defender; los de aquí abajo sí: uno apaga una fuente por un
 * agujero de cobertura que se puede comprobar, y el otro no cambia cómo se
 * puntúa, solo cuánta evidencia se exige para poder ser respuesta, y dice en
 * qué se paga. Ver convex/scoring/config.ts.
 *
 * Cada decisión es un grupo con la pregunta arriba y las opciones debajo.
 * En una sola línea los verbos y las pastillas se leían como una frase y no
 * se distinguía qué era un tope, qué era un umbral y qué se podía apagar.
 */

const TECHOS = ["1", "3", "8", ""];

const ETIQUETA_FAMILIA: Record<IdFamilia, string> = {
  gpt: es.filtros.soloGpt,
  claude: es.filtros.soloClaude,
  gemini: es.filtros.soloGemini,
  grok: es.filtros.soloGrok,
};

/**
 * El mínimo de benchmarks que pide la URL, tal cual viene.
 *
 * Aquí no se valida nada: quien decide qué valores tienen sentido es
 * `minimoDeBenchmarks` en la configuración, que es también quien tendría que
 * hacerlo si el umbral cambiara. Un número absurdo en la barra de direcciones
 * acaba en el valor por defecto allí, no en una segunda regla escrita aquí.
 */
export const minimoPedido = (minimo?: string): number | undefined =>
  minimo ? Number(minimo) : undefined;

/** Las fuentes apagadas que vienen en la URL, como lista. */
export const fuentesApagadas = (sin?: string): string[] =>
  sin ? sin.split(",").filter(Boolean) : [];

export { catalogoDeModelos, modelosOcultos, type ModeloEnLista } from "@/convex/scoring/filtros";

export function BarraDeFiltros({
  params,
  techo,
  metricas,
  umbrales,
  modelos,
}: {
  params: ParamsPortada;
  techo: string;
  metricas: Metodologia["metricas"];
  /** El umbral de la metodología, que es también la opción por defecto. */
  umbrales: Metodologia["umbrales"];
  modelos: ModeloEnLista[];
}) {
  const apagadas = fuentesApagadas(params.sin);
  const cuentan = metricas.filter((m) => !apagadas.includes(m.fuente));
  // Solo se pueden apagar las que declaran un sesgo de cobertura. Las demás no
  // tienen nada que explicar, y un interruptor sin motivo es una invitación a
  // mover la metodología hasta que dé la respuesta que uno quería.
  const apagables = metricas.filter((m) => m.sesgo);
  // Dos opciones y no un deslizador: el umbral de la metodología y uno, que es
  // "todo lo que alguien ha medido". Los valores de en medio no existen porque
  // no hay ninguna razón que los defienda.
  const { benchmarksMinimos: porDefecto, benchmarksMinimosSuelo: suelo } = umbrales;
  const minimos = [porDefecto, suelo];
  const minimo = params.minimo === String(suelo) ? suelo : porDefecto;
  const familia = params.familia && esFamilia(params.familia) ? params.familia : undefined;
  const ocultos = modelosOcultos(params.ocultos ?? params.sinModelo);
  const soloAbiertos = params.abiertos === "1";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-10">
        <Grupo id="atajos" etiqueta={es.filtros.atajos}>
          {/* Un atajo a la vez: familia y open weight se apagan entre sí. */}
          {IDS_FAMILIA.map((id) => (
            <Opcion
              key={id}
              href={enlace(params, {
                familia: familia === id ? "" : id,
                abiertos: "",
              })}
              activa={familia === id}
            >
              {ETIQUETA_FAMILIA[id]}
            </Opcion>
          ))}
          <Opcion
            href={enlace(params, {
              abiertos: soloAbiertos ? "" : "1",
              familia: "",
            })}
            activa={soloAbiertos}
          >
            {es.filtros.soloOpenWeight}
          </Opcion>
        </Grupo>
      </div>

      {modelos.length ? <ListaOcultar params={params} modelos={modelos} ocultos={ocultos} /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-10">
        <Grupo id="tope" etiqueta={es.filtros.maxPorTarea}>
          {TECHOS.map((valor) => (
            <Opcion
              key={valor || "libre"}
              href={enlace(params, { max: valor })}
              activa={techo === valor}
            >
              {valor ? es.filtros.hasta(valor) : es.filtros.sinTechoCorto}
            </Opcion>
          ))}
        </Grupo>

        {porDefecto > suelo ? (
          <Grupo id="minimo" etiqueta={es.filtros.minimo}>
            {minimos.map((n) => (
              <Opcion
                key={n}
                href={enlace(params, { minimo: n === porDefecto ? "" : String(n) })}
                activa={minimo === n}
                ayuda={n === suelo ? es.filtros.minimoUnoAyuda : undefined}
                ayudaId={n === suelo ? "minimo-uno" : undefined}
              >
                {es.filtros.minimoPastilla(n)}
              </Opcion>
            ))}
          </Grupo>
        ) : null}

        {apagables.map((m) => {
          const fuera = apagadas.includes(m.fuente);
          const encender = apagadas.filter((f) => f !== m.fuente);
          const apagar = [...apagadas, m.fuente];
          return (
            <Grupo
              key={m.fuente}
              id={`fuente-${m.fuente}`}
              etiqueta={m.etiqueta}
              ayuda={m.sesgo}
              ayudaId={`sesgo-${m.fuente}`}
            >
              <Opcion
                href={enlace(params, { sin: encender.join(",") })}
                activa={!fuera}
                ayudaId={`sesgo-${m.fuente}`}
              >
                {es.filtros.cuenta}
              </Opcion>
              <Opcion
                href={enlace(params, { sin: apagar.join(",") })}
                activa={fuera}
                ayudaId={`sesgo-${m.fuente}`}
              >
                {es.filtros.noCuenta}
              </Opcion>
            </Grupo>
          );
        })}
      </div>

      {/* Recapitula lo que no cabe en las pastillas: los benchmarks que
          siempre puntúan, y el efecto de lo elegido. En táctil es también
          donde se lee la explicación, porque el tooltip pide hover. El
          copiar enlace va aquí y no dentro de "filtrar modelos": esa lista
          está cerrada y el recorte ya se ve en esta línea. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
          {[
            es.filtros.puntuaCon(enumerar(cuentan.map((m) => m.etiqueta))),
            minimo < porDefecto && es.filtros.conUnBenchmark,
            techo && es.filtros.conTope(techo),
            familia && ETIQUETA_FAMILIA[familia],
            soloAbiertos && es.filtros.soloOpenWeight,
            ocultos.length > 0 && es.filtros.ocultosN(ocultos.length),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <CopiarEnlace />
      </div>
    </div>
  );
}

/** "a", "a y b", "a, b y c". */
const enumerar = (partes: string[]): string =>
  partes.length < 2 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;

function Grupo({
  id,
  etiqueta,
  ayuda,
  ayudaId,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  ayudaId?: string;
  children: React.ReactNode;
}) {
  const tituloId = `filtro-${id}`;
  const titulo = (
    <span id={tituloId} className="font-mono text-xs text-muted-foreground">
      {etiqueta}
    </span>
  );

  return (
    <div
      role="group"
      aria-labelledby={tituloId}
      className={cn("flex min-w-0 flex-col gap-2", ayuda && "grupo-con-ayuda")}
    >
      {titulo}
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {ayuda && ayudaId ? (
        <span id={ayudaId} role="tooltip" className="ayuda">
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}

function Opcion({
  href,
  activa,
  ayuda,
  ayudaId,
  children,
}: {
  href: string;
  activa: boolean;
  ayuda?: string;
  ayudaId?: string;
  children: React.ReactNode;
}) {
  const opcion = (
    <Link
      href={href}
      scroll={false}
      aria-current={activa ? "true" : undefined}
      aria-describedby={ayudaId}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 font-mono text-[13px] leading-none transition-colors",
        activa
          ? "border-foreground bg-foreground font-medium text-background"
          : "border-border text-foreground/75 hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );

  if (!ayuda) return opcion;

  return (
    <span className="opcion">
      {opcion}
      <span id={ayudaId} role="tooltip" className="ayuda">
        {ayuda}
      </span>
    </span>
  );
}
