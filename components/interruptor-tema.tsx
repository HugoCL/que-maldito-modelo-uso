"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { CLAVE_TEMA, CONSULTA_OSCURO, TEMAS, esTema, type Tema } from "@/lib/tema";
import { cn } from "@/lib/utils";

/**
 * Claro, oscuro o lo que diga el sistema.
 *
 * Tres estados y no dos: con una clase `.dark` puesta a mano, «lo que diga el
 * sistema» deja de existir en cuanto alguien toca el interruptor una vez, y ese
 * es el estado en el que llega casi todo el mundo. Guardarlo como `sistema` es
 * lo que permite volver.
 *
 * El script que pone la clase antes del primer pintado está en el layout, no
 * aquí: este componente se hidrata tarde y para entonces la página ya se ha
 * dibujado. Aquí solo se cambia de estado y se escucha lo que pase fuera.
 *
 * El tema no es estado de React, es estado del navegador: vive en
 * `localStorage` y en una clase del `<html>`, lo puede cambiar otra pestaña y lo
 * puede cambiar el sistema operativo al anochecer. Por eso se lee con
 * `useSyncExternalStore` y no con `useState` más un efecto.
 */
const ICONO = { sistema: Monitor, claro: Sun, oscuro: Moon };

function leer(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    return esTema(guardado) ? guardado : "sistema";
  } catch {
    // Navegador con el almacenamiento capado: se queda en `sistema`, que es
    // exactamente lo que hace la página sin JavaScript.
    return "sistema";
  }
}

function aplicar(tema: Tema) {
  const oscuro =
    tema === "oscuro" || (tema === "sistema" && window.matchMedia(CONSULTA_OSCURO).matches);
  document.documentElement.classList.toggle("dark", oscuro);
}

/**
 * Lo que pasa fuera y hay que atender: que el sistema cambie de tema mientras
 * la página está abierta, y que otra pestaña toque el interruptor. En los dos
 * casos la clase se aplica aquí mismo, porque cuando el tema guardado sigue
 * siendo `sistema` no hay ningún valor nuevo que le haga volver a pintar a
 * React, y la página se quedaría con el tema viejo.
 */
function suscribir(alCambiar: () => void) {
  const responder = () => {
    aplicar(leer());
    alCambiar();
  };
  const mq = window.matchMedia(CONSULTA_OSCURO);
  mq.addEventListener("change", responder);
  window.addEventListener("storage", responder);
  return () => {
    mq.removeEventListener("change", responder);
    window.removeEventListener("storage", responder);
  };
}

export function InterruptorTema() {
  // En el servidor no hay tema que leer: `null` dice «todavía no se sabe», y es
  // lo que mantiene el icono callado hasta que se hidrata en vez de enseñar el
  // que no es durante un instante.
  const tema = useSyncExternalStore(suscribir, leer, () => null);
  const actual = tema ?? "sistema";

  const siguiente = TEMAS[(TEMAS.indexOf(actual) + 1) % TEMAS.length];
  const Icono = ICONO[actual];

  const cambiar = () => {
    try {
      localStorage.setItem(CLAVE_TEMA, siguiente);
    } catch {
      // Sin poder guardarlo el interruptor sigue funcionando en esta página.
    }
    aplicar(siguiente);
    // `localStorage` no avisa a la pestaña que lo escribe, así que el aviso lo
    // damos nosotros con un evento que `suscribir` ya está escuchando.
    window.dispatchEvent(new StorageEvent("storage", { key: CLAVE_TEMA }));
  };

  return (
    <button
      type="button"
      onClick={cambiar}
      title={es.tema.cambiar(es.tema[siguiente])}
      aria-label={es.tema.cambiar(es.tema[siguiente])}
      className={cn(
        "-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md",
        "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      )}
    >
      <Icono className={cn("size-4 transition-opacity", tema ? "opacity-100" : "opacity-0")} />
    </button>
  );
}
