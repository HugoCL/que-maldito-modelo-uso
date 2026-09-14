import Link from "next/link";
import { obtenerMetodologia, obtenerVariantes } from "@/lib/datos";
import { es } from "@/lib/i18n/es";
import type { MetricaDeVariante, Variante } from "@/lib/types";

export const metadata = { title: "Metodología" };

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Los pesos, los umbrales y las fuentes salen de la misma configuración que
 * hace el cálculo, y los ejemplos salen de los datos de hoy.
 *
 * Ninguna cifra va escrita a mano aquí. Un sitio cuyo argumento es que los
 * números se actualizan solos no puede tener la explicación de esos números
 * congelada en el HTML: envejece sin que nadie se entere, y es justo la página
 * que alguien abre cuando ya desconfía.
 */
export default async function Metodologia() {
  const [{ metricas, umbrales, mezclaDeTokens, fuentes }, variantes] = await Promise.all([
    obtenerMetodologia(),
    obtenerVariantes(),
  ]);

  const effort = ejemploDeEffort(variantes);
  const banda = ejemploDeBanda(variantes);
  const sueltas = medidasPorUnaFuente(variantes, umbrales.benchmarksMinimos);
  const conSesgo = metricas.filter((m) => m.sesgo);
  const cobertura = coberturaPorBenchmark(variantes);

  return (
    <main className="mx-auto flex w-full max-w-[700px] flex-col gap-9 px-5 py-10 sm:px-[30px]">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-[30px] leading-[1.05] font-semibold tracking-[-0.03em]">
          Cómo se calcula
        </h1>
        <p className="text-pretty text-sm leading-[1.55] text-muted-foreground">
          Ninguna de las tres respuestas está elegida a mano. Salen de cruzar {metricas.length}{" "}
          benchmarks con el costo real por tarea y aplicar tres reglas. Si alguna sorprende, lo que
          hay que discutir es qué benchmarks entran.
        </p>
      </header>

      {effort ? (
        <Seccion titulo="La unidad es el modelo por nivel de effort">
          <p>
            No recomendamos un modelo, recomendamos un modelo a un nivel de effort. Ahora mismo el
            caso más caro de ignorarlo es este: en {effort.metrica.etiqueta},{" "}
            <strong>{effort.barato.modelName}</strong> en <code>{effort.barato.effort}</code> saca{" "}
            <Cifra>{effort.valorBarato.toFixed(1)}%</Cifra> a{" "}
            <Cifra>${effort.barato.cost!.toFixed(2)}</Cifra> por tarea y en{" "}
            <code>{effort.caro.effort}</code> saca <Cifra>{effort.valorCaro.toFixed(1)}%</Cifra> a{" "}
            <Cifra>${effort.caro.cost!.toFixed(2)}</Cifra>. Son{" "}
            <Cifra>{effort.puntos.toFixed(1)}</Cifra> puntos por{" "}
            <Cifra>{effort.razon.toFixed(1)}</Cifra> veces el precio. Tratar las dos
            configuraciones como el mismo modelo esconde justo la decisión que más dinero mueve.
          </p>
        </Seccion>
      ) : null}

      <Seccion titulo="Calidad">
        <p>
          Cada benchmark se normaliza contra el mejor y el peor resultado del conjunto completo, no
          del subconjunto que dejen tus filtros, para que un mismo modelo no cambie de número al
          mover un control. Después se promedia.
        </p>
        <p>
          <strong>Todos los que entran pesan lo mismo.</strong> Nadie sabe si CursorBench vale
          exactamente 1.2 veces lo que vale DeepSWE, y un número con dos decimales parece medido
          aunque esté inventado. Lo único que se decide es cuáles entran.
        </p>
        <Filas>
          {metricas.map((m) => (
            <Fila
              key={m.metric}
              izquierda={m.etiqueta}
              derecha={m.peso.toFixed(2)}
              nota={m.vidaMediaMeses ? `decae a la mitad cada ${m.vidaMediaMeses} meses` : undefined}
            />
          ))}
        </Filas>
        {conSesgo.length ? (
          <>
            <p>
              Una fuente puede medir bien y aun así no medir a todos. Cuando eso pasa se dice aquí
              y se puede apagar desde la página principal, que recalcula las tres respuestas sin
              ella en vez de tacharlas de una lista ya hecha. No es elegir qué benchmark te
              conviene: es poder ver cuánto de la respuesta lo estaba sosteniendo una fuente con un
              agujero conocido.
            </p>
            {conSesgo.map((m) => (
              <p key={m.metric} className="text-[13px] leading-[1.55] text-muted-foreground">
                <strong className="font-medium text-foreground">{m.etiqueta}</strong>: {m.sesgo}
              </p>
            ))}
          </>
        ) : null}
        <p>
          Solo cuentan los benchmarks que existen para ese modelo, y los pesos se renormalizan. Para
          poder ganar una tarjeta hacen falta al menos{" "}
          <Cifra>{umbrales.benchmarksMinimos}</Cifra> benchmarks distintos: sin esa regla, un modelo
          medido por uno solo, el que mejor le venga, sale con calidad 100 y se cuela por delante de
          otro medido por tres. Los que no llegan no se borran: tienen su nota, su ficha y{" "}
          <a href="#una-fuente" className="underline underline-offset-4">
            su lista aquí abajo
          </a>
          .
        </p>
        <p>
          Ese mínimo se puede bajar desde la página principal, en «{es.filtros.minimo}». Bajarlo a{" "}
          <Cifra>{umbrales.benchmarksMinimosSuelo}</Cifra> no cambia las notas: cambia quién puede
          ser respuesta. Entran los medidos una sola vez, marcados como confianza baja. Se queda en{" "}
          <Cifra>{umbrales.benchmarksMinimos}</Cifra> porque si no, los baratos de un solo benchmark
          se comen el medio y el día a día se queda sin candidatos.
        </p>
      </Seccion>

      {banda ? (
        <Seccion titulo="La banda, no el punto">
          <p>
            Los benchmarks que publican intervalos de confianza los publican anchos. La banda más
            ancha que hay hoy es la de <strong>{banda.modelName}</strong> en{" "}
            <code>{banda.effort}</code>: calidad <Cifra>{banda.quality.toFixed(1)}</Cifra> con un
            intervalo que va de <Cifra>{banda.qualityLo.toFixed(1)}</Cifra> a{" "}
            <Cifra>{banda.qualityHi.toFixed(1)}</Cifra>. Ordenar por el número central y presumir
            de décimas sería fingir una precisión que la medición no tiene.
          </p>
          <p>
            Por eso <strong>cuando dos intervalos se solapan, el desempate es el costo</strong>. Es
            lo que hace que la tarjeta de &ldquo;necesito uno bueno&rdquo; a veces recomiende algo
            más barato que el primero de la tabla: son indistinguibles, y uno cuesta menos.
          </p>
        </Seccion>
      ) : null}

      <Seccion titulo="Costo">
        <p>
          Cuando un benchmark mide cuánto costó de verdad resolver sus tareas, usamos ese número, y
          cuando hay más de uno mostramos el rango.
        </p>
        <p>
          No todo &ldquo;$ por tarea&rdquo; es comparable: hace falta que el harness sea el mismo y
          que las tareas se parezcan. Un costo reportado por cada equipo con su propio montaje
          sobre tareas más fáciles hace aparecer modelos &ldquo;de siete centavos&rdquo; que no lo
          son, así que no entra en el eje de costo aunque lo guardemos.
        </p>
        <p>
          Para lo que nadie ha costeado, estimamos a partir del precio de lista con una mezcla de
          tokens agéntica: <Cifra>{pct(mezclaDeTokens.cacheRead)}</Cifra> lecturas de caché,{" "}
          <Cifra>{pct(mezclaDeTokens.input)}</Cifra> entrada fresca y{" "}
          <Cifra>{pct(mezclaDeTokens.output)}</Cifra> salida. No es una suposición: sale del
          desglose de tokens que publica DeepSWE por corrida. El clásico 3:1 entrada:salida se
          equivoca casi por un orden de magnitud en este tipo de carga. Todo lo estimado va marcado
          como tal.
        </p>
      </Seccion>

      <Seccion titulo="Las tres reglas">
        <p>
          Primero se descarta lo dominado: si otro modelo es mejor <em>y</em> más barato, ninguna
          respuesta puede ser este. Lo que queda es el frontier, donde cada paso es un intercambio
          real.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Barato</strong>: el de mayor calidad dentro del{" "}
            <Cifra>{pct(umbrales.percentilCostoBarato)}</Cifra> más económico, siempre que conserve
            al menos el <Cifra>{pct(umbrales.pisoCalidadBarato)}</Cifra> de la calidad del líder. El
            piso existe porque un modelo que se equivoca sale más caro en revisiones de lo que
            ahorra en tokens.
          </li>
          <li>
            <strong>Día a día</strong>: se traza una línea entre el extremo barato y el mejor, con el
            costo en escala logarítmica porque la diferencia entre $1 y $2 se siente como la de $8 a
            $16, y gana el punto del frontier que más se aleja hacia arriba de esa línea, sin bajar
            del <Cifra>{pct(umbrales.pisoCalidadDiaADia)}</Cifra> de la calidad del líder.
          </li>
          <li>
            <strong>Necesito uno bueno</strong>: el de más calidad; entre los que empatan dentro del
            margen de error, el más barato.
          </li>
        </ul>
        <p>
          Las tres tienen que ser tres modelos distintos y en orden de precio. Cuando no hay datos
          para las tres, salen dos: repetir el mismo modelo en dos tarjetas sería fingir una
          elección que no existe.
        </p>
      </Seccion>

      {sueltas.length ? (
        <Seccion titulo="Lo que mide un solo benchmark" id="una-fuente">
          <p>
            Estas <Cifra>{sueltas.reduce((n, m) => n + m.variantes, 0)}</Cifra> variantes, de{" "}
            <Cifra>{sueltas.length}</Cifra> modelos, tienen nota pero no compiten por las tres
            respuestas: solo las ha medido un benchmark. No es un juicio sobre el modelo, es una
            cuenta de cuánta evidencia hay.{" "}
            <Link href="/?minimo=1" className="underline underline-offset-4">
              Aquí están compitiendo
            </Link>
            , por si prefieres verlo así.
          </p>
          <Filas>
            {sueltas.map((m) => (
              <Fila
                key={m.nombre}
                izquierda={m.nombre}
                derecha={m.variantes === 1 ? "1 variante" : `${m.variantes} variantes`}
                nota={[...m.benchmarks, m.abierto ? es.filtros.openWeight : null]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </Filas>
          <p>
            El sesgo salta a la vista al contar cuántos modelos mide cada benchmark y cuántos de
            ellos son open weight. Mientras esto siga así, casi todo lo abierto se queda en
            esta lista por falta de una segunda fuente, no por rendir peor.
          </p>
          <Filas>
            {cobertura.map((c) => (
              <Fila
                key={c.etiqueta}
                izquierda={c.etiqueta}
                derecha={`${c.modelos} modelos`}
                nota={
                  c.abiertos === 0
                    ? es.filtros.openWeightNinguno
                    : c.abiertos === 1
                      ? es.filtros.openWeightUno
                      : es.filtros.openWeightN(c.abiertos)
                }
              />
            ))}
          </Filas>
        </Seccion>
      ) : null}

      <Seccion titulo="Lo que esto no es">
        <p>
          No es una medición propia: no corremos ningún benchmark, cruzamos los de otros. Si una
          fuente se equivoca, nosotros nos equivocamos con ella. Y un modelo recién salido tarda en
          aparecer, porque hasta que alguien lo mide no tenemos nada que decir de él.
        </p>
        <p className="font-mono text-[11.5px] text-muted-foreground">
          {fuentes.filter((f) => f.activa).length} fuentes activas ·{" "}
          {variantes.length} variantes puntuadas
        </p>
      </Seccion>
    </main>
  );
}

/**
 * El salto de effort que más caro sale ignorar.
 *
 * No es el que más multiplica el precio a secas: entre la variante inservible
 * de un modelo y la buena hay saltos de 50×, y eso no ilustra nada, porque
 * nadie dudaba de que el effort mínimo rinde menos. El caso que interesa es
 * el otro: cuando la barata ya hace casi lo mismo y la cara cuesta varias
 * veces más. Por eso se exige que la barata conserve al menos `PISO` de lo que
 * saca la cara, y entre las que lo cumplen gana la que más multiplica.
 */
const PISO_DEL_EJEMPLO = 0.8;

function ejemploDeEffort(variantes: Variante[]) {
  const porModelo = new Map<string, Variante[]>();
  for (const v of variantes) {
    if (v.cost === undefined || v.cost <= 0 || v.effort === "default") continue;
    porModelo.set(v.modelKey, [...(porModelo.get(v.modelKey) ?? []), v]);
  }

  type Ejemplo = {
    barato: Variante;
    caro: Variante;
    metrica: MetricaDeVariante;
    valorBarato: number;
    valorCaro: number;
    puntos: number;
    razon: number;
  };
  let mejor: Ejemplo | null = null;

  for (const vs of porModelo.values()) {
    for (const barato of vs) {
      for (const caro of vs) {
        if (caro.cost! <= barato.cost!) continue;

        // Comparado siempre sobre un benchmark que midió a las dos variantes:
        // dos números de benchmarks distintos no se restan.
        const comun = barato.metricas.find((m) => caro.metricas.some((x) => x.metric === m.metric));
        if (!comun) continue;
        const valorCaro = caro.metricas.find((x) => x.metric === comun.metric)!.valor;

        if (valorCaro <= comun.valor) continue;
        if (comun.valor < valorCaro * PISO_DEL_EJEMPLO) continue;

        const razon = caro.cost! / barato.cost!;
        if (razon < 1.5) continue;
        if (!mejor || razon > mejor.razon) {
          mejor = {
            barato,
            caro,
            metrica: comun,
            valorBarato: comun.valor,
            valorCaro,
            puntos: valorCaro - comun.valor,
            razon,
          };
        }
      }
    }
  }
  return mejor;
}

/** La banda de incertidumbre más ancha que hay hoy. */
function ejemploDeBanda(variantes: Variante[]): Variante | undefined {
  return [...variantes]
    .filter((v) => v.qualityHi > v.qualityLo && v.effort !== "default")
    .sort((a, b) => b.qualityHi - b.qualityLo - (a.qualityHi - a.qualityLo))[0];
}

/**
 * Los modelos que un solo benchmark ha medido, agrupados por modelo.
 *
 * Se agrupa porque la lista suelta son casi cuarenta filas de la misma media
 * docena de modelos en distintos niveles de effort, y lo que hay que ver aquí
 * no es cuántas variantes hay sino qué modelos se quedan fuera y quién los
 * midió.
 */
function medidasPorUnaFuente(variantes: Variante[], minimo: number) {
  const porModelo = new Map<
    string,
    { nombre: string; abierto: boolean; benchmarks: Set<string>; variantes: number; mejor: number }
  >();

  for (const v of variantes) {
    if (v.benchmarks === 0 || v.benchmarks >= minimo) continue;
    const entrada = porModelo.get(v.modelKey) ?? {
      nombre: v.modelName,
      abierto: !!v.openWeights,
      benchmarks: new Set<string>(),
      variantes: 0,
      mejor: 0,
    };
    for (const m of v.metricas) entrada.benchmarks.add(m.etiqueta);
    entrada.variantes += 1;
    entrada.mejor = Math.max(entrada.mejor, v.quality);
    porModelo.set(v.modelKey, entrada);
  }

  return [...porModelo.values()].sort((a, b) => b.mejor - a.mejor);
}

/**
 * Cuántos modelos mide cada benchmark y cuántos de ellos son open weight.
 * Sale de los datos de hoy, no de una frase escrita a mano: el día
 * que CursorBench empiece a medir modelos abiertos, esta tabla lo dice sola.
 */
function coberturaPorBenchmark(variantes: Variante[]) {
  const porBenchmark = new Map<string, { modelos: Set<string>; abiertos: Set<string> }>();

  for (const v of variantes) {
    for (const m of v.metricas) {
      const entrada = porBenchmark.get(m.etiqueta) ?? {
        modelos: new Set<string>(),
        abiertos: new Set<string>(),
      };
      entrada.modelos.add(v.modelKey);
      if (v.openWeights) entrada.abiertos.add(v.modelKey);
      porBenchmark.set(m.etiqueta, entrada);
    }
  }

  return [...porBenchmark.entries()]
    .map(([etiqueta, c]) => ({
      etiqueta,
      modelos: c.modelos.size,
      abiertos: c.abiertos.size,
    }))
    .sort((a, b) => b.modelos - a.modelos);
}

function Seccion({
  titulo,
  id,
  children,
}: {
  titulo: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-6 border-t pt-7">
      <h2 className="font-heading text-lg font-semibold">{titulo}</h2>
      <div className="flex flex-col gap-4 text-pretty text-sm leading-[1.65]">{children}</div>
    </section>
  );
}

function Filas({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col overflow-hidden rounded-[10px] border">{children}</div>;
}

function Fila({
  izquierda,
  derecha,
  nota,
}: {
  izquierda: string;
  derecha: string;
  nota?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] leading-[1.2] font-medium">{izquierda}</span>
        {nota ? (
          <span className="font-mono text-[11.5px] leading-[1.3] text-muted-foreground">
            {nota}
          </span>
        ) : null}
      </div>
      <span className="shrink-0 font-mono text-[13px] tabular-nums">{derecha}</span>
    </div>
  );
}

const Cifra = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono tabular-nums">{children}</span>
);
