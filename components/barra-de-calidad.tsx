import { cn } from "@/lib/utils";

/**
 * Calidad con su banda de incertidumbre.
 *
 * Es el gráfico que define el sitio. Casi todos los leaderboards enseñan un
 * número solo; DeepSWE y Terminal-Bench publican intervalos de confianza y son
 * anchos —tres o cuatro puntos porcentuales— así que dibujar solo el punto
 * sería fingir una precisión que la medición no tiene. La banda clara es el
 * intervalo; la marca es el punto.
 */
export function BarraDeCalidad({
  valor,
  lo,
  hi,
  className,
  tono = "neutro",
}: {
  valor: number;
  lo: number;
  hi: number;
  className?: string;
  tono?: "neutro" | "barato" | "dia_a_dia" | "bueno";
}) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, n))}%`;
  const ancho = Math.max(hi - lo, 0.8);

  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`Calidad ${valor.toFixed(1)} de 100, entre ${lo.toFixed(1)} y ${hi.toFixed(1)}`}
    >
      {/* Relleno sólido hasta el extremo bajo: lo que es seguro. */}
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", tonos[tono].solido)}
        style={{ width: pct(lo) }}
      />
      {/* Banda del intervalo: lo que no distinguimos. */}
      <div
        className={cn("absolute inset-y-0 rounded-full opacity-40", tonos[tono].solido)}
        style={{ left: pct(lo), width: pct(ancho) }}
      />
      {/* El punto estimado. */}
      <div
        className={cn("absolute inset-y-0 w-0.5", tonos[tono].marca)}
        style={{ left: pct(valor) }}
      />
    </div>
  );
}

const tonos = {
  neutro: { solido: "bg-muted-foreground/60", marca: "bg-foreground" },
  barato: { solido: "bg-chart-1", marca: "bg-foreground" },
  dia_a_dia: { solido: "bg-chart-3", marca: "bg-foreground" },
  bueno: { solido: "bg-chart-5", marca: "bg-foreground" },
} as const;
