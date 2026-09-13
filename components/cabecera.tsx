import Link from "next/link";
import { es } from "@/lib/i18n/es";

/**
 * La marca completa lleva censura y ocupa media línea. Arriba va la versión
 * corta y siempre monoespaciada: el nombre largo ya es el <h1> de la portada,
 * repetirlo dos veces en la misma pantalla no informa de nada.
 */
export function Cabecera() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-[940px] items-center justify-between gap-4 px-5 py-3.5 sm:px-[30px]">
        <Link href="/" className="font-mono text-xs font-medium">
          {es.marca.nombreCorto}
        </Link>
        <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
          <Link href="/metodologia" className="hover:text-foreground">
            {es.nav.metodologia}
          </Link>
          <Link href="/estado" className="hover:text-foreground">
            {es.nav.estado}
          </Link>
        </div>
      </nav>
    </header>
  );
}
