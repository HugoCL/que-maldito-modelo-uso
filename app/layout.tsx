import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { Cabecera } from "@/components/cabecera";
import { Pie } from "@/components/pie";
import { CLAVE_TEMA, CONSULTA_OSCURO } from "@/lib/tema";
import { SOURCES } from "@/convex/sources/registry";
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
 * Nada se prerenderiza. Todo lo que se ve en este sitio sale de una consulta a
 * Convex, y esas consultas no se cachean: prerenderizar cualquier página la
 * congelaría con los datos del build. Sin esto, `/creditos`, `/estado` y
 * `/metodologia` se quedaban con la instantánea de la semilla hasta el
 * siguiente despliegue, que es exactamente lo que este sitio promete no hacer.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: es.marca.nombre,
    template: `%s · ${es.marca.nombre}`,
  },
  // La lista de benchmarks sale del registro: una fuente que se añade o se
  // quita no puede dejar la descripción del sitio mintiendo en los buscadores.
  description:
    "Qué modelo usar para programar, en tres respuestas: uno barato para mantenimiento, " +
    "uno para el día a día y uno para cuando la tarea es difícil. Cruza " +
    SOURCES.filter((s) => s.enabled && s.kind === "benchmark")
      .map((s) => s.name)
      .join(", ") +
    " con el costo real por tarea.",
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
