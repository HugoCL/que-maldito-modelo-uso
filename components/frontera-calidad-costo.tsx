"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CartesianGrid,
  Cell,
  Label,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import type { Tarjeta, Tier, Variante } from "@/lib/types";
import { es } from "@/lib/i18n/es";

/**
 * La frontera dibujada: calidad contra costo por tarea.
 *
 * El eje de costo es logarítmico a propósito. Con un rango que va de dos
 * centavos a dieciocho dólares, una escala lineal amontona todo lo barato
 * contra el margen izquierdo — que es justo la parte que más gente necesita
 * mirar.
 *
 * Los tres ganadores van marcados sobre la misma curva: así se ve de un
 * vistazo que las tarjetas no son tres elecciones sueltas sino tres puntos de
 * un mismo intercambio.
 */

const config = {
  calidad: { label: "Calidad", color: "var(--chart-3)" },
  barato: { label: es.tiers.barato.titulo, color: "var(--chart-1)" },
  dia_a_dia: { label: es.tiers.dia_a_dia.titulo, color: "var(--chart-3)" },
  bueno: { label: es.tiers.bueno.titulo, color: "var(--chart-5)" },
} satisfies ChartConfig;

type Punto = {
  x: number;
  y: number;
  nombre: string;
  effort: string;
  costo: number;
  calidad: number;
  lo: number;
  hi: number;
  tier: Tier | null;
  medido: boolean;
};

export function FronteraCalidadCosto({
  variantes,
  tarjetas,
}: {
  variantes: Variante[];
  tarjetas: Tarjeta[];
}) {
  const ganadores = new Map<string, Tier>(
    tarjetas.map((t) => [t.ganador.variantKey, t.tier]),
  );

  const puntos: Punto[] = variantes
    .filter((v) => v.cost !== undefined && v.cost > 0)
    .map((v) => ({
      x: v.cost!,
      y: v.quality,
      nombre: v.modelName,
      effort: v.effort,
      costo: v.cost!,
      calidad: v.quality,
      lo: v.qualityLo,
      hi: v.qualityHi,
      tier: ganadores.get(v.variantKey) ?? null,
      medido: v.costMeasured,
    }))
    .sort((a, b) => a.x - b.x);

  if (puntos.length < 2) return null;

  const minX = puntos[0].x;
  const maxX = puntos[puntos.length - 1].x;
  const marcasX = marcasLogaritmicas(minX, maxX);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lo que compra cada dólar</CardTitle>
        <CardDescription>
          Cada punto es un modelo a un nivel de effort. Solo aparecen los que no están dominados:
          para cualquiera de ellos, subir de calidad cuesta más y ahorrar cuesta calidad.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/7] w-full">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 32, left: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              scale="log"
              domain={[minX * 0.7, maxX * 1.4]}
              ticks={marcasX}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v: number) => (v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`)}
            >
              <Label
                value="costo por tarea (escala logarítmica)"
                position="bottom"
                offset={12}
                className="fill-muted-foreground text-xs"
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={32}
            />
            {/* Sin animación a propósito. Recharts monta el globo en (0,0) y
                lo mueve al punto con una transición, así que al primer hover se
                ve salir volando desde la esquina superior izquierda. */}
            <ChartTooltip
              cursor={false}
              isAnimationActive={false}
              animationDuration={0}
              content={<Globo />}
            />
            <Scatter
              data={puntos}
              line={{ stroke: "var(--chart-3)", strokeWidth: 2 }}
              isAnimationActive={false}
            >
              {puntos.map((p) => (
                <Cell
                  key={`${p.nombre}-${p.effort}`}
                  // Los ganadores se pintan con el color de su tarjeta; el
                  // resto queda en gris para que no compitan por la mirada.
                  fill={p.tier ? `var(--color-${p.tier})` : "var(--muted-foreground)"}
                  r={p.tier ? 7 : 4}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/**
 * En escala logarítmica recharts no genera marcas por su cuenta, así que hay
 * que dárselas. Se usan 1, 2 y 5 por década —la progresión de siempre para ejes
 * log— y si el rango cae dentro de una sola década se añaden las mitades para
 * que el eje no quede con dos números sueltos.
 */
function marcasLogaritmicas(min: number, max: number): number[] {
  const marcas: number[] = [];
  for (let exp = Math.floor(Math.log10(min)); exp <= Math.ceil(Math.log10(max)); exp++) {
    for (const mantisa of [1, 2, 5]) {
      const v = mantisa * 10 ** exp;
      if (v >= min * 0.7 && v <= max * 1.4) marcas.push(v);
    }
  }
  return marcas.length >= 3 ? marcas : [min, Math.sqrt(min * max), max];
}

function Globo({ active, payload }: { active?: boolean; payload?: Array<{ payload: Punto }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">
        {p.nombre}
        {p.effort !== "default" ? (
          <span className="text-muted-foreground"> · {p.effort}</span>
        ) : null}
      </p>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{es.tarjeta.calidad}</span>
        <span className="font-mono tabular-nums">
          {p.calidad.toFixed(1)}
          <span className="text-muted-foreground">
            {" "}
            [{p.lo.toFixed(1)}–{p.hi.toFixed(1)}]
          </span>
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{es.tarjeta.costo}</span>
        <span className="font-mono tabular-nums">${p.costo.toFixed(2)}</span>
      </div>
      <p className="text-muted-foreground">
        {p.medido ? es.tarjeta.costoMedido : es.tarjeta.costoEstimado}
        {p.tier ? ` · ${config[p.tier].label}` : ""}
      </p>
    </div>
  );
}
