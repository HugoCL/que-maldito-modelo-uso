import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BarraDeCalidad } from "@/components/barra-de-calidad";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { Tarjeta } from "@/lib/types";

/**
 * El preset trae una rampa azul secuencial en --chart-1..5. Asignarla en orden
 * —barato el tono más claro, "bueno" el más oscuro— hace que las tres tarjetas
 * se lean como una escala y no como tres categorías sueltas.
 */
const ORDEN_VISUAL = {
  barato: { acento: "border-t-chart-1", numero: "01" },
  dia_a_dia: { acento: "border-t-chart-3", numero: "02" },
  bueno: { acento: "border-t-chart-5", numero: "03" },
} as const;

export function TarjetaRecomendacion({ tarjeta }: { tarjeta: Tarjeta }) {
  const { tier, ganador, segundo, razon } = tarjeta;
  const t = es.tiers[tier];
  const visual = ORDEN_VISUAL[tier];

  return (
    <Card className={cn("h-full border-t-4", visual.acento)}>
      <CardHeader>
        <CardDescription className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
          <span className="text-muted-foreground/60">{visual.numero}</span>
          {t.subtitulo}
        </CardDescription>
        <CardTitle className="text-2xl">{t.titulo}</CardTitle>
        <CardAction>
          <Badge variant={ganador.confidence === "alta" ? "secondary" : "outline"}>
            {es.tarjeta.confianza[ganador.confidence]}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-balance font-heading text-3xl leading-tight font-semibold">
            {ganador.modelName}
          </p>
          <p className="text-sm text-muted-foreground">
            {ganador.creator}
            {ganador.effort !== "default" ? (
              <>
                {" · "}
                <span className="font-mono">
                  {es.tarjeta.effort} {ganador.effort}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{es.tarjeta.calidad}</p>
            <p className="font-mono text-2xl tabular-nums">{ganador.quality.toFixed(0)}</p>
            <BarraDeCalidad
              valor={ganador.quality}
              lo={ganador.qualityLo}
              hi={ganador.qualityHi}
              tono={tier}
            />
            <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {ganador.qualityLo.toFixed(1)}–{ganador.qualityHi.toFixed(1)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{es.tarjeta.costo}</p>
            <p className="font-mono text-2xl tabular-nums">
              {ganador.cost !== undefined ? `$${ganador.cost.toFixed(2)}` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {ganador.costMeasured ? es.tarjeta.costoMedido : es.tarjeta.costoEstimado}
              {ganador.costLo !== undefined && ganador.costHi !== undefined ? (
                <span className="font-mono tabular-nums">
                  {" "}
                  · ${ganador.costLo.toFixed(2)}–${ganador.costHi.toFixed(2)}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{razon}</p>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{es.tarjeta.medidoPor}</p>
          <div className="flex flex-wrap gap-1.5">
            {ganador.metricas.map((m) => (
              <Badge key={m.metric} variant="outline" className="font-mono text-[11px]">
                {m.etiqueta} {m.valor.toFixed(1)}%
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch gap-3">
        {segundo ? (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              {es.tarjeta.alternativa}:{" "}
              <Link
                href={`/modelo/${segundo.modelKey}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {segundo.modelName}
                {segundo.effort !== "default" ? ` (${segundo.effort})` : ""}
              </Link>
              {segundo.cost !== undefined ? (
                <span className="font-mono tabular-nums"> · ${segundo.cost.toFixed(2)}</span>
              ) : null}
            </p>
          </>
        ) : null}
        {/* nativeButton={false} porque lo que se renderiza es un <a>: Base UI
            necesita saberlo para no prometer semántica de botón nativo. */}
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href={`/modelo/${ganador.modelKey}`} />}
        >
          {es.tarjeta.verFicha}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}
