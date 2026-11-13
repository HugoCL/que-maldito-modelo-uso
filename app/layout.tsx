import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { Cabecera } from "@/components/cabecera";
import { Pie } from "@/components/pie";
import { CLAVE_TEMA, CONSULTA_OSCURO } from "@/lib/tema";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import "./globals.css";

/**
 * Instrument Sans para el texto (la del preset) y Geist Mono para los números.
 * Casi toda la información de este sitio son cifras que se comparan en columna,
 * así que la monoespaciada con `tabular-nums` no es decoración: alinea.
 */
const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

/**
 * Nada se prerenderiza. La portada archivada no consulta nada, pero las páginas
 * de antes siguen en el código, redirigidas, y leen de Convex: sin esto el
 * build intentaría prerenderizarlas contra la base.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: es.marca.nombre,
    template: `%s · ${es.marca.nombre}`,
  },
  description:
    "Proyecto archivado. Fuentes para elegir modelo de código: " +
    "FrontierCode, CursorBench, Terminal-Bench, ProgramBench, Artificial Analysis, OpenRouter y models.dev.",
};

/**
 * El tema, puesto antes del primer pintado.
 *
 * Tiene que ser un script en línea y bloqueante: cualquier otra cosa (un efecto
 * de React, un módulo aparte) llega después de que el navegador haya dibujado, y
 * lo que se ve entonces es la página en claro durante un instante antes de
 * saltar a oscuro. Va sin depender de nada, porque corre antes que todo.
 *
 * Si el almacenamiento está capado, el `catch` deja la página en claro, que es
 * lo mismo que hace sin JavaScript.
 */
const GUION_DEL_TEMA = `try{var t=localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});if(t==="oscuro"||((!t||t==="sistema")&&matchMedia(${JSON.stringify(CONSULTA_OSCURO)}).matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      // El script de arriba le añade una clase antes de que React mire, y sin
      // esto React se queja de que el servidor mandó otra cosa.
      suppressHydrationWarning
      className={cn(
        "h-full font-sans antialiased",
        instrumentSans.variable,
        geistMono.variable,
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: GUION_DEL_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Cabecera />
        {children}
        <Pie />
      </body>
    </html>
  );
}
