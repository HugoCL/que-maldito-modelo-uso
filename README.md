# Qué m*ldito modelo uso

Tres respuestas a "¿qué modelo uso para programar?", actualizadas solas cada día:

| | |
|---|---|
| **Barato** | mantenimiento, tests, boilerplate, arreglos de bajo riesgo |
| **Día a día** | la mejor relación entre lo que rinde y lo que cuesta |
| **Necesito uno bueno** | la tarea es difícil y el presupuesto da igual |

La unidad que se recomienda no es el modelo sino el **modelo a un nivel de reasoning effort**.
El mismo modelo en `low` y en `max` no cuesta ni rinde lo mismo, y la diferencia de precio suele
ser de varias veces por unos pocos puntos. Tratarlos como el mismo modelo esconde justo la
decisión que más dinero mueve.

El ejemplo concreto no está escrito aquí a propósito: [/metodologia](app/metodologia/page.tsx) lo
calcula del conjunto de hoy y enseña el peor salto que haya ahora mismo. Un número pegado en un
README es verdad el día que se escribe.

## Puesta en marcha

```bash
pnpm install
```

```bash
npx convex dev
```

El segundo comando pide iniciar sesión, crea el proyecto de Convex, genera `convex/_generated/`
(que no está en el repo) y deja el backend corriendo. Después:

```bash
pnpm dev
```

**Sin Convex también arranca.** Si `NEXT_PUBLIC_CONVEX_URL` no está definida, la web usa la
instantánea de `lib/datos-semilla.ts` y lo dice en pantalla. Unos datos de hace semanas
presentados como frescos serían peor que no tener web.

La primera corrida del pipeline se lanza a mano:

```bash
npx convex run ingest/orchestrator:runAll '{"trigger":"manual"}'
```

Después el cron de `convex/crons.ts` lo repite cada día a las 06:00 UTC.

## Despliegue

La web en Vercel, el backend en Convex, y un solo build para los dos:

```bash
npx convex deploy --cmd 'pnpm build'
```

Está en [`vercel.json`](vercel.json). Despliega primero las funciones de Convex
y solo entonces construye la web, con `NEXT_PUBLIC_CONVEX_URL` ya apuntando al
despliegue de producción. Así la web nunca sale con un backend más viejo que
ella.

En Vercel hace falta una variable, `CONVEX_DEPLOY_KEY`, que es una *production
deploy key* del proyecto de Convex (Dashboard, Settings, Deploy keys). Sin ella
el build falla a propósito en vez de publicar una web sin datos.

La primera corrida del pipeline en producción se lanza a mano; después la coge
el cron:

```bash
npx convex run --prod 'ingest/orchestrator:runAll' '{"trigger":"manual"}'
```

Ninguna página se prerenderiza ([`app/layout.tsx`](app/layout.tsx) fuerza el
renderizado dinámico). Todo lo que se ve sale de una consulta a Convex que no se
cachea, así que prerenderizar cualquier página la dejaría congelada con los
datos del build, que es justo lo que este sitio promete no hacer.

## Fuentes

Ninguna medición es nuestra. El pipeline cruza el trabajo de otros y enlaza siempre al original.

| Fuente | Qué aporta |
|---|---|
| [models.dev](https://models.dev) (MIT) | catálogo canónico: precios, contexto, fechas, capacidades |
| [DeepSWE v1.1](https://deepswe.datacurve.ai/) | `pass@1` con intervalos de confianza sobre 4 corridas, y costo real por tarea |
| [CursorBench 4.0](https://cursor.com/cursorbench) | tareas multi-archivo de sesiones reales, con costo por tarea y por effort |
| [Terminal-Bench 4.0](https://www.tbench.ai/) | trabajo agéntico de terminal de punta a punta |
| [OpenRouter](https://openrouter.ai) | disponibilidad y uso real en programación |

Para entrar, un benchmark tiene que medir modelos que alguien pueda usar hoy y solaparse con
los demás: si ninguna de sus variantes aparece también en otra fuente, ninguna llega a los dos
benchmarks que hacen falta para ser una respuesta, y la fuente entera no cambia nada.

**Artificial Analysis está integrada pero apagada.** Los términos de su API gratuita dicen
*internal use only; no redistribution*, y publicar sus índices en un sitio público es
redistribuir. El adapter está escrito en `convex/sources/artificialAnalysis.ts` con
`enabled: false`; se enciende el día que haya licencia comercial o permiso escrito.

## La escala común

Cada benchmark mide a quien puede, y no todos miden al mismo grupo. El que también mide a los
modelos flojos tiene el suelo más abajo, así que reescalar a 0–100 contra el peor y el mejor de
*su* grupo deja tres escalas que no cuadran: un 70 de uno y un 70 de otro no valían lo mismo, y al
promediarlos la nota acababa diciendo **quién te midió** en vez de cómo rendiste.

Así que antes de promediar se mide cuánto puntúa de más o de menos cada benchmark sobre **los
modelos que comparte con otro** y se le resta. Es una resta, la misma para todos los modelos que
mide esa fuente: corrige el nivel sin tocar cuánto manda ese benchmark en la nota. El ancla es la
fuente de mayor cobertura, así que lo que se mueve es lo que mide a menos gente.

Después, cada nota se acerca al centro del conjunto según **cuántos benchmarks la sostienen**. Una
media de dos se mueve más que una de tres, y sin corregirlo los extremos de la tabla se llenan de
modelos con poca evidencia, que no es lo mismo que modelos buenos. Cuánto se acerca no lo elegimos:
sale de dividir cuánto se contradicen los benchmarks entre sí por cuánto se diferencian los
modelos. Si coincidieran siempre, no habría nada que corregir.

Las dos correcciones se calculan sobre el universo entero, nunca sobre lo que dejen tus filtros.
[/metodologia](app/metodologia/page.tsx) publica los desniveles de hoy, el divisor del
encogimiento y la pareja de benchmarks que peor cuadra pese a todo: la resta arregla el nivel, no
la anchura, y callarlo sería el mismo pecado que este archivo dice no cometer.

El costo tiene la misma enfermedad y el mismo tratamiento. Las tareas de un benchmark no son las de
otro, así que el mismo modelo cuesta distinto según quién lo costeara; se nivela igual, sobre los
modelos que las fuentes comparten, salvo que ahí la diferencia es multiplicativa. Lo que sale de
todo eso es un **índice de eficiencia**: sirve para ordenar modelos entre sí, no para estimar tu
factura.

## Los pesos

**Todos los benchmarks que entran pesan lo mismo.** Nadie sabe si CursorBench vale exactamente
1.2 veces lo que vale DeepSWE, y un número con dos decimales parece medido aunque esté inventado.
Un reparto así decide quién sale recomendado sin que haya forma de defenderlo.

Lo único que se decide es **cuáles entran**, y eso se decide encendiendo y apagando fuentes en
[`convex/scoring/config.ts`](convex/scoring/config.ts), no en un control de la web.

Aquí hubo perfiles de tarea, que repartían los benchmarks según si ibas a arreglar bugs o a dejar
un agente suelto. Se quitaron porque eran el mismo pecado con otra cara: afirmar que Terminal-Bench
mide el trabajo sin supervisión y CursorBench no es una opinión sin medir, tan indefendible como
decir que uno vale 0.35 y otro 0.30. Un control que reparte los benchmarks por corazonada da tres
respuestas distintas y ninguna razón para preferir una.

Una fuente se puede **apagar desde la web** si tiene un agujero de cobertura conocido, y solo por
eso. Hoy es el caso de CursorBench: Cursor ya no puede correr los modelos de OpenAI, así que sus
cifras para esos modelos se quedan quietas mientras las del resto siguen. El motivo se escribe en
el campo `sesgo` de la métrica en [`convex/scoring/config.ts`](convex/scoring/config.ts), y de ahí
salen solos el interruptor de la portada, su explicación al pasar por encima y el párrafo de
/metodologia. Sin `sesgo` no hay interruptor: un control sin motivo escrito es una invitación a
mover la metodología hasta que dé la respuesta que uno quería.

Para poder ser una respuesta hacen falta **dos benchmarks distintos**. Se cuentan fuentes y no
fracciones de peso: con los pesos iguales, "la mitad de los pesos" sería *un solo* benchmark de los
tres, justo lo que esa regla existe para impedir.

Esa regla tiene una consecuencia incómoda que la web dice en voz alta en vez de esconder: **casi
todo lo open weight la incumple**. DeepSWE mide unos cuantos modelos open weight, Terminal-Bench
mide uno y CursorBench ninguno, así que se quedan con una sola fuente y no optan a las tarjetas. Se
puntúan igual, se cuentan bajo el gráfico y están listados en
[/metodologia](app/metodologia/page.tsx). Los
números de esa sección se cuentan de los datos de hoy: el día que un benchmark empiece a medir
modelos abiertos, la tabla lo dice sola.

El umbral se puede **bajar a uno desde la portada** («para ser respuesta», o `?minimo=1`), y es lo único que
deja entrar a esos modelos: elegir qué benchmarks cuentan no puede, porque apagar una fuente solo
puede bajarle la cuenta a una variante, nunca subírsela. Bajarlo no cambia ninguna nota (los
extremos de normalización salen del universo entero), solo quién puede ser respuesta, y lo que
entra sale marcado como confianza baja en la fila y en las suplentes. Viene sin bajar porque la
respuesta que se da sin tocar nada tiene que ser la defendible, y porque al aflojarlo se ve
enseguida por qué: hoy los baratos con una sola medición aplastan el tramo intermedio y la
respuesta del día a día se queda sin candidatos, que es exactamente lo que la regla evita. La
portada lo dice en esa situación en vez de enseñar dos tarjetas sin explicación.

## La tarjeta que a veces falta

«Día a día» es la única de las tres que se define **en relación con las otras dos**: el mejor es el
mejor y el barato es el mejor de los baratos, pero el del día a día tiene que caer *entre* ambos.
Cuando un filtro recorta el conjunto, a menudo no queda sitio, y la web enseñaba dos tarjetas
diciendo «no hay datos» —que casi nunca era verdad: datos había de sobra—.

Ahora pasan dos cosas. Cuando el codo cae **exactamente** en el barato o en el mejor, esa es la
respuesta del día a día y la tarjeta sale repitiendo ese modelo, marcada en la propia fila: *el
barato es también el que dejarías puesto* es una respuesta, y de las útiles. El repliegue solo actúa
cuando no hay un tercer modelo, así que no puede robarle la tarjeta a nadie; y exige un codo de
verdad, interior de la curva y por encima de la cuerda, porque el punto más barato tiene exceso cero
por construcción y si no se colaría siempre.

Y cuando de verdad no hay respuesta, se dice **cuál** de los tres motivos es: no quedan tres
intercambios distintos, no hay codo (todo lo de en medio rinde peor que quedarse en un extremo), o
lo que hay en medio no llega al piso de calidad, y entonces se enseña por cuánto se queda. El piso
no se mueve para que salga la respuesta que uno quería —el mismo argumento por el que aquí no hay
perfiles de tarea— pero el número se publica para poder discutirlo.

## Cómo está montado

```
convex/
  sources/       un archivo por fuente: { meta, parse }. Añadir una es un archivo
                 y una línea en registry.ts
  matching/      de "Fable 5.1 Max" al modelo del catálogo. Lo que no resuelve
                 cae en unresolvedKeys con su sugerencia; nunca se adivina
  scoring/       config.ts (qué benchmarks entran y cuánto pesan),
                 compute.ts (calidad y costo), tiers.ts (frontier, codo,
                 las tres reglas)
  ingest/        orquestador, snapshots con hash, bitácora de corridas
  public/        las consultas que lee la web
app/, components/, lib/   Next.js App Router + shadcn/ui, copy en lib/i18n/es.ts
tests/, scripts/          tests contra fixtures reales y herramientas de diagnóstico
```

El icono tampoco es un archivo: `app/icon.tsx` y `app/apple-icon.tsx` lo dibujan en el build con
`ImageResponse`, a partir de la marca de [`lib/marca.tsx`](lib/marca.tsx). Es el asterisco de la
censura del nombre, con una barra por respuesta y el color de su tarjeta, así que el día que cambie
la paleta el icono cambia con ella en vez de quedarse enseñando la del año pasado. No lleva texto a
propósito: Satori exige una fuente en cuanto hay una letra, y sin ninguna el icono no se puede
romper porque una fuente no esté disponible al construir.

Las observaciones se guardan en formato largo (`sourceId`, `variante`, `métrica`, `valor`), así
que **cambiar la metodología nunca requiere volver a descargar nada**: se recalcula sobre lo que
ya hay.

La metodología completa está en [/metodologia](app/metodologia/page.tsx) y los umbrales en
[`convex/scoring/config.ts`](convex/scoring/config.ts). Si una recomendación sorprende, ahí es
donde hay que discutir.

## Desarrollo

```bash
pnpm test
```

80 tests contra fixtures reales capturados de cada fuente (`tests/fixtures/`). Cubren los
parsers, la resolución de nombres y las propiedades del scoring: que nunca se recomiende una
variante dominada, que las tres respuestas salgan siempre en orden de precio, que dos modelos con
intervalos solapados se desempaten por costo, y que bajar el mínimo de benchmarks solo añada
candidatos, nunca quite, y los añada marcados.

Y las de la tarjeta que falta: que haya respuesta para el día a día **si y solo si** no hay motivo
para que falte, que un modelo repetido en dos tarjetas venga siempre marcado y que la marca apunte
de verdad a la otra, y que ni el extremo de la curva ni un punto por debajo de la cuerda se cuelen
como codo.

Y las de la escala común, que son las que impiden que vuelva a colarse lo de antes: que nivelar
deje a cada benchmark sin residuo sobre los modelos que mide, que la calidad media no baje al subir
la evidencia, que con la misma medida la nota sostenida por tres benchmarks quede por encima de la
sostenida por uno, y que dos variantes igual de eficientes salgan al mismo precio aunque las haya
costeado una fuente distinta.

Un cambio de maquetación río arriba rompe un test, no la producción.

```bash
npx vite-node scripts/preview-recomendaciones.ts
```

Corre el pipeline entero sobre los fixtures e imprime las tres tarjetas en la terminal.

```bash
npx vite-node scripts/diagnose-matching.ts
```

Qué nombres resuelve cada fuente y cuáles no. Es la herramienta para mantener
`convex/matching/aliases.ts`.

```bash
npx vite-node scripts/generar-datos-semilla.ts
```

Regenera `lib/datos-semilla.ts` desde los fixtures.

## Notas de instalación

`pnpm-workspace.yaml` tiene dos `overrides` que no son caprichos: la configuración global de pnpm
de este equipo exige provenance attestation y un mínimo de tres días desde la publicación. En vez
de desactivar esos chequeos, las dependencias transitivas afectadas se suben a una versión que sí
está firmada. El motivo está comentado en el archivo.
