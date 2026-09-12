import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { obtenerMetodologia } from "@/lib/datos";

export const metadata = { title: "Metodología" };

/**
 * Los pesos y las fuentes salen de la misma configuración que hace el cálculo,
 * así que esta página no puede desfasarse del código. Lo que se explica en
 * prosa sí hay que mantenerlo a mano.
 */
export default async function Metodologia() {
  const { metricas, perfiles, fuentes } = await obtenerMetodologia();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">Cómo se calcula</h1>
        <p className="text-pretty text-muted-foreground">
          Ninguna de las tres respuestas está elegida a mano. Salen de cruzar cinco benchmarks con
          el costo real por tarea y aplicar tres reglas. Si alguna sorprende, lo que hay que
          discutir son los pesos de abajo.
        </p>
      </header>

      <Seccion titulo="La unidad es el modelo por nivel de effort">
        <p>
          No recomendamos &ldquo;Opus 5&rdquo;, recomendamos &ldquo;Opus 5 en medium&rdquo;. Los
          números lo justifican: en CursorBench, Fable 5.1 en <code>low</code> saca 45.1% a $5.44
          por tarea y en <code>max</code> saca 51.8% a $17.28. Son 6.7 puntos por 3.2 veces el
          precio. Tratar las dos configuraciones como el mismo modelo esconde justo la decisión que
          más dinero mueve.
        </p>
      </Seccion>

      <Seccion titulo="Calidad">
        <p>
          Cada benchmark se normaliza contra el mejor y el peor resultado del conjunto completo —no
          del subconjunto que dejen tus filtros, para que un mismo modelo no cambie de número al
          mover un control— y después se promedia con estos pesos:
        </p>
        <ul className="flex flex-col gap-2">
          {metricas.map((m) => (
            <li key={m.metric} className="flex items-baseline justify-between gap-4">
              <span>{m.etiqueta}</span>
              <span className="flex items-center gap-3">
                {m.vidaMediaMeses ? (
                  <span className="text-xs text-muted-foreground">
                    decae a la mitad cada {m.vidaMediaMeses} meses
                  </span>
                ) : null}
                <Badge variant="outline" className="font-mono">
                  {m.peso.toFixed(2)}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
        <p>
          Solo cuentan las métricas que existen para ese modelo, y los pesos se renormalizan. La
          suma de los pesos disponibles es la <strong>cobertura</strong>: por debajo del 50% la
          variante sigue apareciendo en su ficha, pero no puede ganar una tarjeta. Sin esa regla, un
          modelo medido únicamente por el benchmark más débil sale con calidad 100 y se cuela por
          delante de otro medido por cuatro.
        </p>
      </Seccion>

      <Seccion titulo="La banda, no el punto">
        <p>
          DeepSWE publica intervalos de confianza sobre cuatro corridas completas del benchmark y
          son anchos: Fable 5 en <code>xhigh</code> es 69.9% ±3.2 puntos. Ordenar por el número
          central y presumir de décimas sería fingir una precisión que la medición no tiene.
        </p>
        <p>
          Por eso cada calidad lleva su banda, y por eso{" "}
          <strong>cuando dos intervalos se solapan, el desempate es el costo</strong>. Es lo que
          hace que la tarjeta de &ldquo;necesito uno bueno&rdquo; a veces recomiende algo más
          barato que el primero de la tabla: son indistinguibles, y uno cuesta menos.
        </p>
      </Seccion>

      <Seccion titulo="Costo">
        <p>
          Cuando un benchmark mide cuánto costó de verdad resolver sus tareas, usamos ese número.
          DeepSWE y CursorBench lo publican, y cuando los dos tienen dato mostramos el rango.
        </p>
        <p>
          No todo &ldquo;$ por tarea&rdquo; es comparable: el <code>instance_cost</code> de
          SWE-bench Verified lo reporta cada equipo con su propio andamio sobre tareas mucho más
          fáciles. Se muestra en la ficha del modelo, pero no entra en el eje de costo; mezclarlo
          hacía aparecer modelos &ldquo;de siete centavos&rdquo; que no lo son.
        </p>
        <p>
          Para lo que nadie ha costeado, estimamos a partir del precio de lista con una mezcla de
          tokens agéntica: 70% lecturas de caché, 20% entrada fresca, 10% salida. No es una
          suposición — DeepSWE publica el desglose y sale en torno a 4.2 millones de tokens de
          entrada por tarea, de los cuales unos 4.0 millones son caché. El clásico 3:1
          entrada:salida se equivoca casi por un orden de magnitud en este tipo de carga. Todo lo
          estimado va marcado como tal.
        </p>
      </Seccion>

      <Seccion titulo="Las tres reglas">
        <p>
          Primero se descarta lo dominado: si otro modelo es mejor <em>y</em> más barato, ninguna
          respuesta puede ser este. Lo que queda es la frontera, donde cada paso es un
          intercambio real.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Barato</strong>: el de mayor calidad dentro del tercio más económico, siempre
            que conserve al menos el 60% de la calidad del líder. El piso existe porque un modelo
            que se equivoca sale más caro en revisiones de lo que ahorra en tokens.
          </li>
          <li>
            <strong>Día a día</strong>: el codo de la frontera. Se traza la cuerda entre el extremo
            barato y el mejor —con el costo en escala logarítmica, porque la diferencia entre $1 y
            $2 se siente como la de $8 a $16— y gana el punto que más se despega hacia arriba de
            esa recta. Es donde pagar más deja de comprar calidad.
          </li>
          <li>
            <strong>Necesito uno bueno</strong>: el de más calidad; entre los que empatan dentro
            del margen de error, el más barato.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Perfiles">
        <p>
          Cambiar el tipo de tarea reordena los pesos y vuelve a correr las tres reglas enteras
          sobre los mismos datos. No es un filtro cosmético sobre un resultado precalculado: para
          &ldquo;agente suelto&rdquo; pesan más Terminal-Bench y DeepSWE, y para
          &ldquo;mantenimiento&rdquo; pesan más los SWE-*.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {perfiles.map((p) => (
            <Badge key={p.id} variant="outline">
              {p.etiqueta}
            </Badge>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Lo que esto no es">
        <p>
          No es una medición propia: no corremos ningún benchmark, cruzamos los de otros. Si una
          fuente se equivoca, nosotros nos equivocamos con ella. Y un modelo recién salido tarda en
          aparecer, porque hasta que alguien lo mide no tenemos nada que decir de él.
        </p>
        <p className="text-sm text-muted-foreground">
          Fuentes activas ahora mismo: {fuentes.filter((f) => f.activa).length} de {fuentes.length}.
        </p>
      </Seccion>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <Separator />
      <h2 className="font-heading text-xl font-semibold">{titulo}</h2>
      <div className="flex flex-col gap-4 text-pretty leading-relaxed">{children}</div>
    </section>
  );
}
