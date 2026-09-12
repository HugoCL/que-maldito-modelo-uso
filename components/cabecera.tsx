import Link from "next/link";
import { es } from "@/lib/i18n/es";

export function Cabecera() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        {/* En pantallas estrechas el nombre completo se parte en dos líneas y
            empuja la navegación. Ahí manda la versión corta, que ya existe. */}
        <Link href="/" className="font-semibold tracking-tight whitespace-nowrap">
          <span className="font-mono text-sm sm:hidden">{es.marca.nombreCorto}</span>
          <span className="hidden text-sm sm:inline">{es.marca.nombre}</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/metodologia" className="hover:text-foreground">
            {es.nav.metodologia}
          </Link>
          <Link href="/creditos" className="hover:text-foreground">
            {es.nav.creditos}
          </Link>
          <Link href="/estado" className="hover:text-foreground">
            {es.nav.estado}
          </Link>
        </div>
      </nav>
    </header>
  );
}
