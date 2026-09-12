import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { Cabecera } from "@/components/cabecera";
import { Pie } from "@/components/pie";
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

export const metadata: Metadata = {
  title: {
    default: es.marca.nombre,
    template: `%s · ${es.marca.nombre}`,
  },
  description:
    "Qué modelo usar para programar, en tres respuestas: uno barato para mantenimiento, " +
    "uno para el día a día y uno para cuando la tarea es difícil. Cruza CursorBench, DeepSWE, " +
    "Terminal-Bench, SWE-rebench y SWE-bench Verified con el costo real por tarea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={cn(
        "h-full font-sans antialiased",
        instrumentSans.variable,
        geistMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <Cabecera />
        {children}
        <Pie />
      </body>
    </html>
  );
}
