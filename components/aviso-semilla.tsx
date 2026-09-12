import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { es } from "@/lib/i18n/es";
import { fechaDeLaSemilla, usandoSemilla } from "@/lib/datos";

/**
 * Sin Convex conectado la web sigue funcionando con una instantánea, pero
 * decirlo es obligatorio: el valor de este sitio es que los datos son de hoy.
 */
export function AvisoSemilla() {
  if (!usandoSemilla) return null;
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>{es.estado.modoSemilla}</AlertTitle>
      <AlertDescription>
        {es.estado.modoSemillaDetalle} {fechaDeLaSemilla}. Conecta un despliegue de Convex
        (<code className="font-mono">npx convex dev</code>) para que se actualice solo cada día.
      </AlertDescription>
    </Alert>
  );
}
