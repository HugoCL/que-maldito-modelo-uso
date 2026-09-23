import Link from "next/link";
import {
  obtenerEscala,
  obtenerMetodologia,
  obtenerRecomendaciones,
  obtenerVariantes,
} from "@/lib/datos";
import { es } from "@/lib/i18n/es";
import type { MetricaDeVariante, Variante } from "@/lib/types";

export const metadata = { title: "Metodología" };

const pct = (n: number) => `${Math.round(n * 100)}%`;
const conSigno = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

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
  const [{ metricas, umbrales, mezclaDeTokens, fuentes }, variantes, escala, recomendaciones] =
    await Promise.all([
      obtenerMetodologia(),
      obtenerVariantes(),
      obtenerEscala(),
      obtenerRecomendaciones(),
    ]);

  // Lo que esta página dice sobre el día a día tiene que cuadrar con lo que se
  // ve en la portada hoy, sin filtros. Escribirlo a mano sería exactamente lo
  // que esta página no hace.
  const hoy = recomendaciones.tarjetas.find((t) => t.tier === "dia_a_dia");

  const effort = ejemploDeEffort(variantes);
  const banda = ejemploDeBanda(variantes);
  const sueltas = medidasPorUnaFuente(variantes, umbrales.benchmarksMinimos);
  const conSesgo = metricas.filter((m) => m.sesgo);
  const cobertura = coberturaPorBenchmark(variantes);
  const desajuste = peorDesajuste(variantes);
  const medias = mediaPorNumeroDeBenchmarks(variantes);
  // Los identificadores de fuente del costo son los mismos que los de las
  // métricas (`cursorbench.score` → `cursorbench`), así que la etiqueta legible
  // sale de la propia lista de benchmarks en vez de una tabla aparte.
  const costePorFuente = Object.entries(escala.costePorFuente)
    .map(([fuente, factor]) => ({
      fuente,
      factor,
      etiqueta: metricas.find((m) => m.fuente === fuente)?.etiqueta ?? fuente,
    }))
    .sort((a, b) => a.factor - b.factor);

  return (
    <main className="mx-auto flex w-full max-w-[700px] flex-col gap-9 px-5 py-10 sm:px-[30px]">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-[30px] leading-[1.05] font-semibold tracking-[-0.03em]">
          Cómo se calcula
        </h1>
        <p className="text-pretty text-sm leading-[1.55] text-muted-foreground">
          Ninguna de las tres respuestas está elegida a mano. Salen de cruzar {metricas.length}{" "}
          benchmarks con el costo real por tarea y aplicar{" "}
          <a href="#reglas" className="underline underline-offset-4 hover:text-foreground">
            tres reglas
          </a>
          . Si alguna sorprende, lo que hay que discutir es qué benchmarks entran.
        </p>
        {/* Un índice: la página es larga y casi nadie viene a leerla entera,
            viene a buscar la respuesta a una duda concreta. Sale de la misma
            condición que pinta cada sección, así que no enlaza a nada que no
            esté. */}
        <nav aria-labelledby="en-esta-pagina" className="mt-2 flex flex-col gap-2 rounded-[10px] border px-4 py-3">
          <span id="en-esta-pagina" className="font-mono text-[11px] text-muted-foreground">
            en esta página
          </span>
          <ol className="flex flex-col gap-1 text-[13px] leading-[1.45] text-foreground/80">
            {[
              effort && ["effort", "La unidad es el modelo por nivel de effort"],
              ["calidad", "Calidad"],
              ["desnivel", "Un 70 no vale lo mismo en todos los benchmarks"],
              ["evidencia", "Cuántas mediciones sostienen la nota"],
              banda && ["banda", "La banda, no el punto"],
              ["costo", "Costo"],
              ["indice", "El $ por tarea es un índice, no tu factura"],
              ["reglas", "Las tres reglas"],
              ["sin-dia-a-dia", "Cuándo no hay respuesta para el día a día"],
              sueltas.length > 0 && ["una-fuente", "Lo que mide un solo benchmark"],
              ["limites", "Lo que esto no es"],
            ]
              .filter((x): x is string[] => Array.isArray(x))
              .map(([id, titulo]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="underline decoration-foreground/25 underline-offset-4 hover:text-foreground hover:decoration-foreground"
                  >
                    {titulo}
                  </a>
                </li>
              ))}
          </ol>
        </nav>
      </header>

      {effort ? (
        <Seccion titulo="La unidad es el modelo por nivel de effort" id="effort">
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

      <Seccion titulo="Calidad" id="calidad">
        <p>
          Cada benchmark se normaliza contra el mejor y el peor resultado del conjunto completo, no
          del subconjunto que dejen tus filtros, para que un mismo modelo no cambie de número al
          mover un control. Después se le quita el{" "}
          <a href="#desnivel" className="underline underline-offset-4">
            desnivel de su fuente
          </a>{" "}
          y se promedia.
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
              y se puede apagar desde la página principal, en «{es.filtros.masAjustes}», que
              recalcula las tres respuestas sin ella en vez de tacharlas de una lista ya hecha. No
              es elegir qué benchmark te conviene: es poder ver cuánto de la respuesta lo estaba
              sosteniendo una fuente con un agujero conocido.
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
          Ese mínimo se puede bajar desde la página principal, en «{es.filtros.masAjustes}». Bajarlo a{" "}
          <Cifra>{umbrales.benchmarksMinimosSuelo}</Cifra> no cambia las notas: cambia quién puede
          ser respuesta. Entran los medidos una sola vez, marcados como confianza baja. Se queda en{" "}
          <Cifra>{umbrales.benchmarksMinimos}</Cifra> porque si no, los baratos de un solo benchmark
          se comen el medio y el día a día se queda sin candidatos.
        </p>
      </Seccion>

      <Seccion titulo="Un 70 no vale lo mismo en todos los benchmarks" id="desnivel">
        <p>
          Reescalar cada benchmark contra su propio peor y su propio mejor resultado da por hecho
          que los tres miden al mismo grupo de modelos, y no es verdad: cada uno mide a quien puede.{" "}
          {cobertura.length ? (
            <>
              Hoy <strong>{cobertura[0].etiqueta}</strong> llega a{" "}
              <Cifra>{cobertura[0].modelos}</Cifra> modelos y{" "}
              <strong>{cobertura[cobertura.length - 1].etiqueta}</strong> a{" "}
              <Cifra>{cobertura[cobertura.length - 1].modelos}</Cifra>.{" "}
            </>
          ) : null}
          Quien mide también a los flojos tiene el suelo más abajo, y eso empuja hacia arriba a
          todos los que mide. El resultado es que un 70 de un benchmark y un 70 de otro no valían lo
          mismo, y al promediarlos la nota acababa diciendo <em>quién te midió</em> en vez de cómo
          rendiste.
        </p>
        <p>
          Así que antes de promediar se mide cuánto puntúa de más o de menos cada benchmark{" "}
          <strong>sobre los modelos que comparte con otro</strong>, y se le resta. No es un peso
          disfrazado: es una resta, la misma para todos los modelos que mide esa fuente, y no cambia
          cuánto manda un benchmark en la nota. El ancla es la fuente de mayor cobertura, así que lo
          que se mueve es lo que mide a menos gente.
        </p>
        <Filas>
          {metricas.map((m) => (
            <Fila
              key={m.metric}
              izquierda={m.etiqueta}
              // El número que se enseña es la corrección, no el desnivel en
              // crudo: es el mismo signo con el que aparece en el desglose de
              // cada ficha, donde se puede sumar a mano y comprobar la nota.
              derecha={conSigno(-(escala.desniveles[m.metric] ?? 0))}
              nota={
                (escala.desniveles[m.metric] ?? 0) === 0
                  ? "el ancla: la escala se deja donde está"
                  : "puntos que se le corrigen a cada resultado suyo"
              }
            />
          ))}
        </Filas>
        {desajuste ? (
          <p>
            Esto corrige el nivel, no la anchura: si dos benchmarks reparten a sus modelos en rangos
            distintos, restarles un número no los cuadra del todo. El peor caso de hoy es{" "}
            <strong>{desajuste.a}</strong> contra <strong>{desajuste.b}</strong>, que solo comparten{" "}
            <Cifra>{desajuste.comparten}</Cifra>{" "}
            {desajuste.comparten === 1 ? "variante" : "variantes"} y siguen separados por{" "}
            <Cifra>{desajuste.puntos.toFixed(0)}</Cifra> puntos después de nivelar. Se dice aquí en
            vez de esconderlo: cuantos menos modelos comparten dos fuentes, menos fiable es el
            desnivel que las une.
          </p>
        ) : null}
      </Seccion>

      <Seccion titulo="Cuántas mediciones sostienen la nota" id="evidencia">
        <p>
          Una media de dos mediciones se mueve más que una de tres. Sin corregirlo, los extremos de
          la tabla se llenan de modelos con poca evidencia: no porque sean mejores ni peores, sino
          porque con menos mediciones es más fácil quedar arriba del todo o abajo del todo.
        </p>
        <p>
          Por eso cada nota se acerca al centro del conjunto —hoy en{" "}
          <Cifra>{escala.centro.toFixed(0)}</Cifra>— según cuántos benchmarks la sostienen. Cuánto
          se acerca <strong>no lo elegimos nosotros</strong>: sale de dividir cuánto se contradicen
          los benchmarks entre sí por cuánto se diferencian los modelos. Si los benchmarks
          coincidieran siempre no habría nada que corregir y dos mediciones bastarían; cuanto más se
          contradicen, menos se puede fiar uno de una media hecha con pocas.
        </p>
        <Filas>
          {[1, 2, 3].map((n) => (
            <Fila
              key={n}
              izquierda={n === 1 ? "1 benchmark" : `${n} benchmarks`}
              derecha={pct(1 - n / (n + escala.k))}
              nota="lo que se acerca al centro"
            />
          ))}
        </Filas>
        <p className="text-[13px] leading-[1.55] text-muted-foreground">
          El divisor de hoy es <Cifra>{escala.k.toFixed(2)}</Cifra>. Con los datos de hoy, la
          calidad media sube con la evidencia: {medias.map((m) => `${m.etiqueta} ${m.media.toFixed(0)}`).join(" · ")}.
          Antes de todo esto bajaba, que era exactamente el problema.
        </p>
      </Seccion>

      {banda ? (
        <Seccion titulo="La banda, no el punto" id="banda">
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

      <Seccion titulo="Costo" id="costo">
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
          <strong>Y las tareas de un benchmark no son las de otro.</strong> Unas son más largas que
          otras, así que el mismo modelo cuesta distinto según quién lo haya costeado, y sacar la
          mediana entre fuentes sin más hacía que un modelo pareciera caro solo por quién se molestó
          en medirlo. Se corrige igual que en la calidad, midiendo la diferencia sobre los modelos
          que las fuentes comparten, salvo que aquí la diferencia es multiplicativa: una fuente no
          cuesta dos dólares más, cuesta tantas veces más.
        </p>
        <Filas>
          {costePorFuente.map((c) => (
            <Fila
              key={c.fuente}
              izquierda={c.etiqueta}
              derecha={`×${c.factor.toFixed(2)}`}
              nota={
                Math.abs(c.factor - 1) < 0.005
                  ? "el ancla: en esta escala se dan los precios"
                  : "lo que cuestan sus tareas en la escala del ancla"
              }
            />
          ))}
        </Filas>
        <p>
          Para lo que nadie ha costeado, estimamos a partir del precio de lista con una mezcla de
          tokens agéntica: <Cifra>{pct(mezclaDeTokens.cacheRead)}</Cifra> lecturas de caché,{" "}
          <Cifra>{pct(mezclaDeTokens.input)}</Cifra> entrada fresca y{" "}
          <Cifra>{pct(mezclaDeTokens.output)}</Cifra> salida. No es una suposición: sale del
          desglose de tokens que publica DeepSWE por run. El clásico 3:1 entrada:salida se
          equivoca casi por un orden de magnitud en este tipo de carga. Todo lo estimado va marcado
          como tal.
        </p>
        <p>
          El factor que lleva de un precio de lista a un costo por tarea sale de los modelos que
          tienen las dos cosas, y se toma la razón <em>típica</em> y no la que mejor ajusta la suma
          de cuadrados. Con precios que van de céntimos a decenas de dólares, minimizar cuadrados
          deja que media docena de modelos caros pongan ellos solos el factor de todos los demás.
        </p>
      </Seccion>

      <Seccion titulo="El $ por tarea es un índice, no tu factura" id="indice">
        <p>
          Después de todo eso, el número que sale ya no es &ldquo;lo que cobró un benchmark&rdquo;:
          es el nivel de costo de un modelo puesto en una escala común, la de las tareas de la
          fuente que mide a más gente. Por eso es un <strong>índice de eficiencia</strong> y hay que
          leerlo como tal.
        </p>
        <p>
          Sirve para lo que se usa aquí: ordenar modelos entre sí y ver cuánto más caro es uno que
          otro. <strong>No predice lo que vas a pagar tú.</strong> Tus tareas no son las de estos
          benchmarks, tu repo es más grande o más pequeño, tu harness reintenta más o menos veces y
          tu prompt arrastra más o menos contexto. Cualquiera de esas cosas mueve la factura varias
          veces; lo que se conserva entre un sitio y otro es el orden, no la cifra.
        </p>
        <p>
          Se enseña en dólares y no como un número sin unidades a propósito: un &ldquo;índice
          72&rdquo; no deja ver que un modelo cuesta veinte veces lo que otro, y esa es la única
          cosa que esta página quiere que se vea. El precio de tener unidades legibles es esta
          advertencia, y por eso está también debajo de la tabla de la página principal y no
          escondida aquí.
        </p>
      </Seccion>

      <Seccion titulo="Las tres reglas" id="reglas">
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
          Las tres salen siempre en orden de precio, y casi siempre son tres modelos distintos.
          Cuando el codo cae <em>exactamente</em> en el barato o en el mejor, la tarjeta del día a
          día repite ese modelo y lo dice en la propia fila. Aquí hubo una regla que lo prohibía, y
          estaba mal: lo que hacía era borrar la tarjeta y dejar a la página diciendo que faltaban
          datos cuando lo que pasaba era otra cosa. «El barato es también el que dejarías puesto» es
          una respuesta, y de las útiles.
        </p>
      </Seccion>

      <Seccion titulo="Cuándo no hay respuesta para el día a día" id="sin-dia-a-dia">
        <p>
          Es la única de las tres que se define en relación con las otras dos: el mejor es el mejor y
          el barato es el mejor de los baratos, pero el del día a día tiene que caer <em>entre</em>{" "}
          ambos. Cuando los filtros recortan mucho el conjunto, a veces no queda sitio. Pasa por tres
          motivos, y la página principal dice cuál de los tres en vez de contarlos todos como falta
          de datos:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>No hay tres intercambios.</strong> Después de descartar lo dominado quedan uno o
            dos modelos. No es que falte un dato: es que con ese filtro no hay tres decisiones
            distintas que tomar.
          </li>
          <li>
            <strong>No hay codo.</strong> Todo lo intermedio rinde peor que interpolar entre el
            barato y el mejor, así que ningún escalón de en medio compensa. La curva sube pareja y lo
            razonable es quedarse en un extremo.
          </li>
          <li>
            <strong>Lo de en medio no llega al piso.</strong> Hay un modelo en el hueco pero no
            alcanza el <Cifra>{pct(umbrales.pisoCalidadDiaADia)}</Cifra> de la calidad del líder. La
            página dice por cuánto se queda. El piso no se mueve para que salga la respuesta que uno
            quería, que es el mismo argumento por el que aquí no hay perfiles de tarea; pero el
            número se enseña para poder discutirlo.
          </li>
        </ul>
        <p className="text-[13px] leading-[1.55] text-muted-foreground">
          {hoy
            ? hoy.repiteA
              ? `Hoy, sin filtros, la del día a día recomienda el mismo modelo que la de «${es.tiers[hoy.repiteA].etiqueta}».`
              : "Hoy, sin filtros, las tres respuestas son tres modelos distintos."
            : "Hoy, sin filtros, no hay respuesta para el día a día."}
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

      <Seccion titulo="Lo que esto no es" id="limites">
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

const mediana = (valores: number[]) => {
  const s = [...valores].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * La pareja de benchmarks que peor cuadra después de nivelar.
 *
 * Restar un número corrige el nivel de una fuente, no su anchura, así que dos
 * benchmarks que reparten a sus modelos en rangos distintos siguen sin
 * coincidir. Esto lo cuenta con los datos de hoy en lugar de dejarlo sin decir:
 * el sitio ya publica los agujeros de cobertura, y este es del mismo tipo.
 */
function peorDesajuste(variantes: Variante[]) {
  const metricas = [...new Set(variantes.flatMap((v) => v.metricas.map((m) => m.metric)))];
  let peor: { a: string; b: string; puntos: number; comparten: number } | null = null;

  for (const a of metricas) {
    for (const b of metricas) {
      if (a >= b) continue;
      const diferencias: number[] = [];
      let etiquetaA = a;
      let etiquetaB = b;
      for (const v of variantes) {
        const ma = v.metricas.find((m) => m.metric === a);
        const mb = v.metricas.find((m) => m.metric === b);
        if (!ma || !mb) continue;
        etiquetaA = ma.etiqueta;
        etiquetaB = mb.etiqueta;
        diferencias.push(ma.normalizado - ma.desnivel - (mb.normalizado - mb.desnivel));
      }
      if (!diferencias.length) continue;
      const puntos = Math.abs(mediana(diferencias));
      if (!peor || puntos > peor.puntos) {
        peor = { a: etiquetaA, b: etiquetaB, puntos, comparten: diferencias.length };
      }
    }
  }
  return peor;
}

/**
 * La calidad media según cuántos benchmarks sostienen la nota. Es la
 * comprobación de que la corrección hace lo que dice: la media tiene que subir
 * con la evidencia, no bajar.
 */
function mediaPorNumeroDeBenchmarks(variantes: Variante[]) {
  return [1, 2, 3]
    .map((n) => {
      const notas = variantes.filter((v) => v.benchmarks === n).map((v) => v.quality);
      return {
        etiqueta: n === 1 ? "con 1" : `con ${n}`,
        media: notas.length ? notas.reduce((a, x) => a + x, 0) / notas.length : 0,
        cuantas: notas.length,
      };
    })
    .filter((m) => m.cuantas > 0);
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
