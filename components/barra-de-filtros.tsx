"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { PerfilId } from "@/lib/types";

/**
 * Los filtros viven en la URL, no en el estado del componente.
 *
 * Así una recomendación filtrada se puede pegar en un chat y le llega igual a
 * quien la abra, el botón de atrás hace lo que debe, y el recálculo ocurre en
 * el servidor con los mismos datos y la misma función que la vista sin
 * filtrar. Un filtro que recorta en el cliente acabaría enseñando algo
 * distinto de lo que dice la metodología.
 */

const PERFILES: Array<{ id: PerfilId; etiqueta: string }> = [
  { id: "general", etiqueta: "Cualquier cosa" },
  { id: "mantenimiento", etiqueta: "Mantenimiento" },
  { id: "agentico", etiqueta: "Agente suelto" },
  { id: "greenfield", etiqueta: "Código nuevo" },
];

const TECHOS = [
  { valor: "", etiqueta: es.filtros.sinTecho },
  { valor: "1", etiqueta: "$1" },
  { valor: "3", etiqueta: "$3" },
  { valor: "8", etiqueta: "$8" },
];

export function BarraDeFiltros() {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, iniciarTransicion] = useTransition();

  const perfil = (params.get("perfil") ?? "general") as PerfilId;
  const techo = params.get("max") ?? "";
  const soloAbiertos = params.get("abiertos") === "1";
  const hayFiltros = perfil !== "general" || techo !== "" || soloAbiertos;

  const actualizar = (cambios: Record<string, string | null>) => {
    const siguiente = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === "") siguiente.delete(k);
      else siguiente.set(k, v);
    }
    const qs = siguiente.toString();
    iniciarTransicion(() => router.replace(qs ? `/?${qs}` : "/", { scroll: false }));
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-xl border bg-card p-5 transition-opacity sm:p-6",
        pendiente && "opacity-60",
      )}
      aria-busy={pendiente}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{es.filtros.titulo}</h2>
        {hayFiltros ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actualizar({ perfil: null, max: null, abiertos: null })}
          >
            <RotateCcwIcon data-icon="inline-start" />
            {es.filtros.limpiar}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{es.filtros.perfil}</p>
        <ToggleGroup
          value={[perfil]}
          onValueChange={(v) => actualizar({ perfil: (v[0] as string) ?? "general" })}
          variant="outline"
          className="flex-wrap"
        >
          {PERFILES.map((p) => (
            <ToggleGroupItem key={p.id} value={p.id}>
              {p.etiqueta}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{es.filtros.presupuesto}</p>
          <ToggleGroup
            value={[techo]}
            onValueChange={(v) => actualizar({ max: (v[0] as string) ?? null })}
            variant="outline"
          >
            {TECHOS.map((t) => (
              <ToggleGroupItem key={t.valor || "libre"} value={t.valor} className="font-mono">
                {t.etiqueta}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 pb-1.5 text-sm">
          <Switch
            checked={soloAbiertos}
            onCheckedChange={(v) => actualizar({ abiertos: v ? "1" : null })}
          />
          {es.filtros.soloOpenWeights}
        </label>
      </div>
    </div>
  );
}
