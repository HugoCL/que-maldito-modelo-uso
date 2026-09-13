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

## Fuentes

Ninguna medición es nuestra. El pipeline cruza el trabajo de otros y enlaza siempre al original.

| Fuente | Qué aporta |
|---|---|
| [models.dev](https://models.dev) (MIT) | catálogo canónico: precios, contexto, fechas, capacidades |
| [DeepSWE v1.1](https://deepswe.datacurve.ai/) | `pass@1` con intervalos de confianza sobre 4 corridas, y costo real por tarea |
| [CursorBench 4.0](https://cursor.com/cursorbench) | tareas multi-archivo de sesiones reales, con costo por tarea y por effort |
| [Terminal-Bench 2.0](https://www.tbench.ai/) | trabajo agéntico de terminal de punta a punta |
| [OpenRouter](https://openrouter.ai) | disponibilidad y uso real en programación |

Para entrar, un benchmark tiene que medir modelos que alguien pueda usar hoy y solaparse con
los demás: si ninguna de sus variantes aparece también en otra fuente, ninguna llega a los dos
benchmarks que hacen falta para ser una respuesta, y la fuente entera no cambia nada.

**Artificial Analysis está integrada pero apagada.** Los términos de su API gratuita dicen
*internal use only; no redistribution*, y publicar sus índices en un sitio público es
redistribuir. El adapter está escrito en `convex/sources/artificialAnalysis.ts` con
`enabled: false`; se enciende el día que haya licencia comercial o permiso escrito.

## Los pesos y los perfiles

**Todos los benchmarks que entran pesan lo mismo.** Nadie sabe si CursorBench vale exactamente
1.2 veces lo que vale DeepSWE, y un número con dos decimales parece medido aunque esté inventado.
Un reparto así decide quién sale recomendado sin que haya forma de defenderlo.

Lo único que se decide es **cuáles entran**, y eso es lo que hace un perfil: `agentico` mira
Terminal-Bench y DeepSWE, `mantenimiento` mira CursorBench y DeepSWE. Esa pregunta, la de si
Terminal-Bench mide el trabajo de arreglar bugs, sí se puede contestar. Está en
[`convex/scoring/config.ts`](convex/scoring/config.ts).

Para poder ser una respuesta hacen falta **dos benchmarks distintos**. Se cuentan fuentes y no
fracciones de peso: con los pesos iguales, "la mitad de los pesos" sería *un solo* benchmark en un
perfil que mira dos, justo lo que esa regla existe para impedir.

## Cómo está montado

```
convex/
  sources/       un archivo por fuente: { meta, parse }. Añadir una es un archivo
                 y una línea en registry.ts
  matching/      de "Fable 5.1 Max" al modelo del catálogo. Lo que no resuelve
                 cae en unresolvedKeys con su sugerencia; nunca se adivina
  scoring/       config.ts (qué benchmarks entran y en qué perfil),
                 compute.ts (calidad y costo), tiers.ts (frontier, codo,
                 las tres reglas)
  ingest/        orquestador, snapshots con hash, bitácora de corridas
  public/        las consultas que lee la web
app/, components/, lib/   Next.js App Router + shadcn/ui, copy en lib/i18n/es.ts
tests/, scripts/          tests contra fixtures reales y herramientas de diagnóstico
```

Las observaciones se guardan en formato largo (`sourceId`, `variante`, `métrica`, `valor`), así
que **cambiar la metodología nunca requiere volver a descargar nada**: se recalcula sobre lo que
ya hay.

La metodología completa está en [/metodologia](app/metodologia/page.tsx) y los perfiles en
[`convex/scoring/config.ts`](convex/scoring/config.ts). Si una recomendación sorprende, ahí es
donde hay que discutir.

## Desarrollo

```bash
pnpm test
```

59 tests contra fixtures reales capturados de cada fuente (`tests/fixtures/`). Cubren los
parsers, la resolución de nombres y las propiedades del scoring: que nunca se recomiende una
variante dominada, que las tres respuestas sean siempre tres modelos distintos y en orden de
precio, y que dos modelos con intervalos solapados se desempaten por costo.

Un cambio de maquetación río arriba rompe un test, no la producción.

```bash
npx vite-node scripts/preview-recomendaciones.ts
```

Corre el pipeline entero sobre los fixtures e imprime las tres tarjetas en la terminal. Acepta un
perfil: `general`, `mantenimiento`, `agentico`.

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
