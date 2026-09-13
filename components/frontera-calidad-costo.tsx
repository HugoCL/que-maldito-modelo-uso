"use client";

import {
  Cell,
  LabelList,
  ZAxis,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { es } from "@/lib/i18n/es";
import type { Tarjeta, Tier, Variante } from "@/lib/types";

/**
 * La frontera: calidad contra costo por tarea.
 *
 * El eje de costo va en logaritmo a propósito. Con un rango que va de treinta
 * centavos a dieciocho dólares, una escala lineal amontona todo lo barato
 * contra el margen izquierdo, que es justo la parte que más gente necesita
 * mirar.
 *
 * Se dibuja siempre la frontera entera, incluido lo que queda por encima del
 * techo de presupuesto: lo que el techo hace es velar esa zona, no borrarla.
 * Un filtro que esconde lo que descarta deja a quien mira sin saber cuánto
 * está renunciando, que es la única pregunta interesante de esta pantalla.
 */

const config = {
  barato: { label: es.tiers.barato.titulo, color: "var(--foreground)" },
  dia_a_dia: { label: es.tiers.dia_a_dia.titulo, color: "var(--primary)" },
  bueno: { label: es.tiers.bueno.titulo, color: "var(--foreground)" },
} satisfies ChartConfig;

type Punto = {
  x: number;
  y: number;
  /** Área del punto. Es lo único que recharts mira para el tamaño. */
  z: number;
  nombre: string;
  effort: string;
  calidad: number;
  lo: number;
  hi: number;
  tier: Tier | null;
  medido: boolean;
  /** De qué lado del punto cabe su etiqueta. Ver ladoLibre(). */
  arriba: boolean;
};

export function FronteraCalidadCosto({
  variantes,
  tarjetas,
  techo,
  enFrontera,
}: {
  variantes: Variante[];
  tarjetas: Tarjeta[];
  techo?: number;
  enFrontera: number;
}) {
  const ganadores = new Map<string, Tier>(tarjetas.map((t) => [t.ganador.variantKey, t.tier]));

  const puntos: Punto[] = variantes
    .filter((v) => v.cost !== undefined && v.cost > 0)
    .map((v) => ({
      x: v.cost!,
      y: v.quality,
      z: ganadores.has(v.variantKey) ? AREA_GANADOR : AREA_RESTO,
      nombre: v.modelName,
      effort: v.effort,
      calidad: v.quality,
      lo: v.qualityLo,
      hi: v.qualityHi,
      tier: ganadores.get(v.variantKey) ?? null,
      medido: v.costMeasured,
      arriba: true,
    }))
    .sort((a, b) => a.x - b.x);

  if (puntos.length < 2) return null;
  for (const [i, p] of puntos.entries()) p.arriba = ladoLibre(puntos, i);

  const desde = marcaBajo(puntos[0].x);
  const hasta = marcaSobre(puntos[puntos.length - 1].x);
  const qMin = Math.max(0, Math.floor((Math.min(...puntos.map((p) => p.y)) - 5) / 5) * 5);

  // Los extremos del dominio son marcas del eje, así que el modelo más barato
  // y el mejor caen justo encima de los ejes y se ven cortados por la esquina.
  // El dominio se abre un poco más que los datos; las marcas siguen donde
  // estaban y los puntos dejan de tocar el borde. En un eje logarítmico el aire
  // se añade multiplicando, no sumando.
  const AIRE = 1.3;

  const bajoElTecho = techo === undefined ? puntos : puntos.filter((p) => p.x <= techo);
  const mejor = bajoElTecho[bajoElTecho.length - 1];

  return (
    <div className="relative h-[196px] rounded-[10px] border pt-[32px] pr-[10px] pb-[6px] pl-[2px]">
      <span className="absolute top-[9px] left-[46px] font-mono text-[11.5px] whitespace-nowrap text-muted-foreground">
        <span className="sm:hidden">{es.portada.ejesCorto(enFrontera)}</span>
        <span className="hidden sm:inline">{es.portada.ejes(enFrontera)}</span>
      </span>
      <span className="absolute top-[9px] right-[30px] hidden font-mono text-[11.5px] text-muted-foreground sm:block">
        {es.portada.bajoElTecho}: {mejor ? nombre(mejor) : "—"}
      </span>

      <ChartContainer
        config={config}
        className="h-full w-full [&_.recharts-cartesian-axis-tick_text]:font-mono [&_.recharts-cartesian-axis-tick_text]:text-[10.5px]"
      >
        <ScatterChart margin={MARGEN}>
          <XAxis
            type="number"
            dataKey="x"
            scale="log"
            domain={[desde / AIRE, hasta * AIRE]}
            ticks={marcas(desde, hasta)}
            // En 375px cinco números en el eje se solapan. minTickGap deja
            // que recharts quite los que no caben y conserve los extremos,
            // que son los que dicen de dónde a dónde va la escala.
            interval="preserveStartEnd"
            minTickGap={26}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickFormatter={(v: number) => (v < 1 ? `$${v.toFixed(2)}` : `$${v}`)}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[qMin - 4, 102]}
            ticks={[qMin, 100]}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            width={34}
          />
          {/* Sin animación a propósito. Recharts monta el globo en (0,0) y lo
              mueve al punto con una transición, así que al primer hover se ve
              salir volando desde la esquina superior izquierda. */}
          {/* El radio no se pone en el Cell: recharts lo ignora y todos los
              puntos saldrían iguales. El tamaño es el eje Z. */}
          <ZAxis type="number" dataKey="z" range={[AREA_RESTO, AREA_GANADOR]} />
          <ChartTooltip cursor={false} isAnimationActive={false} content={<Globo />} />
          <Scatter data={puntos} isAnimationActive={false}>
            {puntos.map((p) => (
              <Cell
                key={`${p.nombre}-${p.effort}`}
                // Los ganadores se pintan con el color de su tarjeta; el resto
                // queda en gris para que no compitan por la mirada.
                fill={p.tier ? `var(--color-${p.tier})` : "var(--muted-foreground)"}
                fillOpacity={p.tier ? 1 : 0.35}
                // Dos variantes con el mismo precio se solapan y se leen como
                // un punto gordo. El borde del color del fondo las separa.
                stroke="var(--background)"
                strokeWidth={1.5}
              />
            ))}
            <LabelList content={<Orden puntos={puntos} />} />
          </Scatter>

          {/* zIndex por encima del de Scatter (600): recharts 3 pinta por
              capas y no por orden de hijos, así que sin esto el velo queda
              debajo de los puntos y no vela nada. */}
          {techo !== undefined && techo < hasta ? (
            <>
              <ReferenceArea
                x1={Math.max(techo, desde)}
                x2={hasta}
                fill="var(--background)"
                fillOpacity={0.85}
                stroke="none"
                ifOverflow="hidden"
                zIndex={1000}
              />
              <ReferenceLine
                x={Math.max(techo, desde)}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.4}
                strokeDasharray="4 4"
                ifOverflow="hidden"
                zIndex={1000}
              />
            </>
          ) : null}
        </ScatterChart>
      </ChartContainer>
    </div>
  );
}

const MARGEN = { top: 20, right: 14, bottom: 0, left: 0 };

/**
 * De qué lado de su punto va la etiqueta 01/02/03.
 *
 * La curva sube siempre, así que el vecino de la izquierda está más abajo y el
 * de la derecha más arriba: el hueco de arriba lo tapa el de la derecha y el de
 * abajo, el de la izquierda. Gana el lado del vecino que esté más lejos, medido
 * en el eje que se dibuja, que es el logaritmo del costo.
 */
function ladoLibre(puntos: Punto[], i: number): boolean {
  const x = Math.log10(puntos[i].x);
  const izquierda = i > 0 ? x - Math.log10(puntos[i - 1].x) : Infinity;
  const derecha = i < puntos.length - 1 ? Math.log10(puntos[i + 1].x) - x : Infinity;
  return derecha >= izquierda;
}

const AREA_GANADOR = 120;
const AREA_RESTO = 42;

const nombre = (p: Punto) => (p.effort === "default" ? p.nombre : `${p.nombre} ${p.effort}`);

/**
 * El 01, 02 y 03 de las tarjetas, sobre su punto de la curva: así se ve que
 * las tres respuestas no son elecciones sueltas sino tres puntos del mismo
 * intercambio. Recharts clona este elemento por dato y le añade x, y e index.
 *
 * Van centradas sobre su punto, no en diagonal: en un tramo apretado de la
 * curva una etiqueta desplazada de lado acaba más cerca del punto del vecino
 * que del suyo. Arriba o abajo lo decide ladoLibre(), y el halo del color del
 * fondo es para cuando ni así queda hueco.
 */
function Orden({
  puntos,
  x,
  y,
  width,
  height,
  index,
}: {
  puntos: Punto[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
}) {
  const p = index !== undefined ? puntos[index] : undefined;
  if (!p?.tier || x === undefined || y === undefined) return null;

  // Recharts no pasa el centro del punto sino la caja que lo envuelve, y el
  // radio del ganador no es pequeño: sin esto la etiqueta sale descentrada
  // hacia arriba y a la izquierda, encima del punto vecino.
  const radio = (height ?? 0) / 2;
  const cx = x + (width ?? 0) / 2;
  const cy = y + radio;
  // Arriba salvo que el punto esté tan alto que la etiqueta se salga del SVG,
  // que recorta lo que se dibuja fuera.
  const arriba = p.arriba && cy - radio - 16 > 1;

  return (
    <text
      x={cx}
      y={cy + (arriba ? -(radio + 5) : radio + 13)}
      textAnchor="middle"
      className={p.tier === "dia_a_dia" ? "fill-primary" : "fill-muted-foreground"}
      style={{
        fontFamily: "var(--font-geist-mono)",
        fontSize: 11,
        paintOrder: "stroke",
        stroke: "var(--background)",
        strokeWidth: 3,
      }}
    >
      {es.tiers[p.tier].orden}
    </text>
  );
}

function Globo({ active, payload }: { active?: boolean; payload?: Array<{ payload: Punto }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">
        {p.nombre}
        {p.effort !== "default" ? <span className="text-muted-foreground"> · {p.effort}</span> : null}
      </p>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{es.tarjeta.calidad}</span>
        <span className="font-mono tabular-nums">
          {p.calidad.toFixed(1)}
          <span className="text-muted-foreground">
            {" "}
            [{p.lo.toFixed(1)}, {p.hi.toFixed(1)}]
          </span>
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{es.tarjeta.costo}</span>
        <span className="font-mono tabular-nums">${p.x.toFixed(2)}</span>
      </div>
      <p className="text-muted-foreground">
        {p.medido ? es.tarjeta.costoMedido : es.tarjeta.costoEstimado}
        {p.tier ? ` · ${config[p.tier].label}` : ""}
      </p>
    </div>
  );
}

/**
 * Marcas 1-2-5 por década, la progresión de siempre para un eje logarítmico.
 * Recharts no genera marcas propias en escala log, así que hay que dárselas.
 * Los extremos del dominio son siempre marcas, así que el eje empieza y acaba
 * en un número escrito y no en un borde arbitrario.
 */
const ESCALONES = [1, 2, 5];

function marcaBajo(v: number): number {
  const exp = Math.floor(Math.log10(v));
  for (const m of [...ESCALONES].reverse()) {
    const c = m * 10 ** exp;
    if (c <= v) return c;
  }
  return 10 ** exp;
}

function marcaSobre(v: number): number {
  const exp = Math.floor(Math.log10(v));
  for (const m of ESCALONES) {
    const c = m * 10 ** exp;
    if (c >= v) return c;
  }
  return 10 ** (exp + 1);
}

function marcas(desde: number, hasta: number): number[] {
  const x0 = Math.log10(desde);
  const x1 = Math.log10(hasta);

  // Tres décadas o más, de dos centavos a veinte dólares, no caben en 1-2-5
  // sin amontonarse: ahí manda una marca por potencia de diez, más los dos
  // extremos, que son los que dicen dónde empieza y dónde acaba lo medido.
  if (x1 - x0 > 2) {
    const out: number[] = [];
    for (let exp = Math.ceil(x0 + 1e-9); exp <= Math.floor(x1 - 1e-9); exp++) out.push(10 ** exp);
    return [desde, ...out, hasta];
  }

  const out: number[] = [];
  for (let exp = Math.floor(x0); exp <= Math.ceil(x1); exp++) {
    for (const m of ESCALONES) {
      const v = m * 10 ** exp;
      const log = Math.log10(v);
      if (log >= x0 - 1e-9 && log <= x1 + 1e-9) out.push(v);
    }
  }
  return out;
}
