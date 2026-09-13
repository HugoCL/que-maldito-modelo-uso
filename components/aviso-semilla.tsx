import { es } from "@/lib/i18n/es";
import { fechaDeLaSemilla, usandoSemilla } from "@/lib/datos";

/**
 * Sin Convex conectado la web sigue funcionando con una instantánea, pero
 * decirlo es obligatorio: el valor de este sitio es que los datos son de hoy.
 */
export function AvisoSemilla() {
  if (!usandoSemilla) return null;

  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-dashed px-4 py-3.5">
      <span className="mt-[6px] size-[9px] shrink-0 rounded-full bg-muted-foreground/50" />
      <div className="flex flex-col gap-1">
        <span className="text-[13.5px] leading-[1.3] font-medium">{es.estado.modoSemilla}</span>
        <span className="font-mono text-[11.5px] leading-[1.5] text-muted-foreground">
          {es.estado.modoSemillaDetalle} {fechaDeLaSemilla} · npx convex dev para que se
          actualice solo cada día
        </span>
      </div>
    </div>
  );
}
