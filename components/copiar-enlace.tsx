"use client";

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";

/**
 * Los filtros ya están en la URL: copiar esta página es copiar el recorte.
 * No hay un id de share; el query string es el contrato.
 */
export function CopiarEnlace() {
  const [copiado, setCopiado] = useState(false);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(reset.current);
  }, []);

  return (
    <button
      type="button"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
        } catch {
          return;
        }
        setCopiado(true);
        clearTimeout(reset.current);
        reset.current = setTimeout(() => setCopiado(false), 2000);
      }}
      className="shrink-0 font-mono text-[13px] text-muted-foreground underline-offset-4 hover:underline"
    >
      {copiado ? es.filtros.enlaceCopiado : es.filtros.copiarEnlace}
    </button>
  );
}
