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
 * compartido sigue corto. «Más ajustes» es un <details> por lo mismo: se
 * pliega y se despliega sin una línea de JavaScript.
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
 *
 * A la vista quedan solo las dos preguntas que se hace casi todo el mundo
 * (qué modelos puedo usar y cuánto quiero gastar). El umbral de evidencia y
 * las fuentes con sesgo cambian cómo se puntúa: van plegados en «más
 * ajustes», con su explicación escrita al lado. Antes ocupaban media barra y
 * empujaban las tres respuestas por debajo del primer pantallazo.
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

  // Lo de "más ajustes" cambia cómo se puntúa, no qué se enseña. Si llega
  // tocado en la URL, el panel sale abierto: esconder un ajuste activo detrás
  // de un plegable es la forma más rápida de que alguien no entienda por qué
  // su respuesta no es la de todo el mundo.
  const ajustesTocados = (minimo < porDefecto ? 1 : 0) + apagadas.length;
  const hayFiltros =
    ajustesTocados > 0 || !!techo || !!familia || soloAbiertos || ocultos.length > 0;

  return (
    <div className="flex flex-col gap-4">
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
      </div>

      {/* Dos plegables, uno debajo del otro. Lo de arriba son las dos
          preguntas que se hace casi todo el mundo; lo de aquí, lo que casi
          nadie necesita tocar y antes ocupaba la mitad de la barra. */}
      <div className="flex flex-col gap-2.5">
        {modelos.length ? <ListaOcultar params={params} modelos={modelos} ocultos={ocultos} /> : null}

        {porDefecto > suelo || apagables.length ? (
          <details open={ajustesTocados > 0} className="group/ajustes">
            <summary className="cursor-pointer font-mono text-xs text-muted-foreground marker:text-muted-foreground/70">
              {es.filtros.masAjustes}
              {ajustesTocados ? ` · ${es.filtros.ajustesTocados(ajustesTocados)}` : ""}
            </summary>
            <div className="mt-3 flex flex-col gap-5">
              {porDefecto > suelo ? (
                <Grupo id="minimo" etiqueta={es.filtros.minimo} nota={es.filtros.minimoUnoAyuda}>
                  {minimos.map((n) => (
                    <Opcion
                      key={n}
                      href={enlace(params, { minimo: n === porDefecto ? "" : String(n) })}
                      activa={minimo === n}
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
                    nota={m.sesgo}
                  >
                    <Opcion href={enlace(params, { sin: encender.join(",") })} activa={!fuera}>
                      {es.filtros.cuenta}
                    </Opcion>
                    <Opcion href={enlace(params, { sin: apagar.join(",") })} activa={fuera}>
                      {es.filtros.noCuenta}
                    </Opcion>
                  </Grupo>
                );
              })}
            </div>
          </details>
        ) : null}
      </div>

      {/* Solo cuando algo está tocado: sin filtros la línea repetía lo que ya
          dicen el titular y el pie de la tabla. Con filtros es el resumen de
          lo que se está viendo, y es donde tiene sentido quitarlos o copiar
          el enlace para mandárselo a alguien. */}
      {hayFiltros ? (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">
            {[
              apagadas.length > 0 && es.filtros.puntuaCon(enumerar(cuentan.map((m) => m.etiqueta))),
              minimo < porDefecto && es.filtros.conUnBenchmark,
              techo && es.filtros.conTope(techo),
              familia && ETIQUETA_FAMILIA[familia],
              soloAbiertos && es.filtros.soloOpenWeight,
              ocultos.length > 0 && es.filtros.ocultosN(ocultos.length),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex shrink-0 items-baseline gap-4">
            <Link
              href="/"
              scroll={false}
              className="font-mono text-[13px] text-muted-foreground underline-offset-4 hover:underline"
            >
              {es.filtros.limpiar.toLowerCase()}
            </Link>
            <CopiarEnlace />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "a", "a y b", "a, b y c". */
const enumerar = (partes: string[]): string =>
  partes.length < 2 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;

function Grupo({
  id,
  etiqueta,
  nota,
  children,
}: {
  id: string;
  etiqueta: string;
  /** Una explicación a la vista, debajo de las opciones. */
  nota?: string;
  children: React.ReactNode;
}) {
  const tituloId = `filtro-${id}`;
  const notaId = nota ? `nota-${id}` : undefined;

  return (
    <div
      role="group"
      aria-labelledby={tituloId}
      aria-describedby={notaId}
      className="flex min-w-0 flex-col gap-2"
    >
      <span id={tituloId} className="font-mono text-xs text-muted-foreground">
        {etiqueta}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {/* A la vista y no al pasar por encima: esto vive dentro de «más
          ajustes», que solo abre quien quiere entenderlo, y un tooltip no se
          ve nunca en una pantalla táctil. */}
      {nota ? (
        <p id={notaId} className="max-w-prose text-pretty text-[12.5px] leading-[1.5] text-muted-foreground">
          {nota}
        </p>
      ) : null}
    </div>
  );
}

function Opcion({
  href,
  activa,
  children,
}: {
  href: string;
  activa: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activa ? "true" : undefined}
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
}
