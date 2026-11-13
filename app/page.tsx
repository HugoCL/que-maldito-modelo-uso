import { ArrowUpRightIcon } from "lucide-react";
import { TituloMutante } from "@/components/titulo-mutante";
import { es } from "@/lib/i18n/es";

type Fuente = {
  nombre: string;
  url: string;
  mide: string;
  nota?: string;
};

const GRUPOS: { titulo: string; fuentes: Fuente[] }[] = [
  {
    titulo: "Benchmarks",
    fuentes: [
      {
        nombre: "FrontierCode",
        url: "https://cognition.com/frontiercode",
        mide: "Si el agente escribe cambios que un maintainer aceptaría. Separa por effort y publica el costo.",
      },
      {
        nombre: "CursorBench",
        url: "https://cursor.com/cursorbench",
        mide: "Tareas de varios archivos sacadas de sesiones reales, con costo por tarea y por effort.",
        nota: "Ya no mide los modelos de OpenAI.",
      },
      {
        nombre: "Terminal-Bench",
        url: "https://www.tbench.ai/",
        mide: "Trabajo agéntico en la terminal, de punta a punta.",
      },
      {
        nombre: "ProgramBench",
        url: "https://programbench.com/",
        mide: "Reconstruir un programa a partir de su binario y su documentación, con el mismo harness para todos y costo por tarea.",
      },
      {
        nombre: "DeepSWE",
        url: "https://deepswe.datacurve.ai/",
        mide: "Tareas largas en 91 repos, con intervalos de confianza.",
        nota: "Sin modelos nuevos desde el 3 de septiembre de 2026.",
      },
    ],
  },
  {
    titulo: "Precios y uso",
    fuentes: [
      {
        nombre: "Artificial Analysis",
        url: "https://artificialanalysis.ai/",
        mide: "Junta varios benchmarks, FrontierCode entre ellos, con precio y velocidad de cada modelo.",
      },
      {
        nombre: "OpenRouter",
        url: "https://openrouter.ai/rankings",
        mide: "Qué modelos usa de verdad la gente para programar.",
      },
      {
        nombre: "models.dev",
        url: "https://models.dev",
        mide: "Precio, contexto y capacidades de cada modelo, en un catálogo abierto.",
      },
    ],
  },
];

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-[940px] flex-col gap-12 px-5 py-10 sm:px-[30px] sm:py-[44px]">
      <section className="hero flex flex-col gap-4 pt-1">
        <p className="font-mono text-[11.5px] leading-none text-muted-foreground">
          archivado · 13 de noviembre de 2026
        </p>
        <TituloMutante
          texto={es.marca.nombreEntero}
          palabra={es.marca.palabrota}
          className="max-w-[680px] text-balance font-heading text-[38px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[54px]"
        />
        <p className="max-w-[600px] text-pretty text-[16px] leading-[1.5] text-foreground/70 sm:text-[17px]">
          Este sitio ya no recomienda modelos. DeepSWE, que era nuestra base, dejó de publicar, y
          varios de los benchmarks que hoy citan los laboratorios restringen cómo se republican sus
          cifras o no lo dejan claro. Así que aquí van las fuentes que usábamos y las que pensábamos
          sumar: ve directo a ellas.
        </p>
        <p className="max-w-[600px] text-pretty text-[14px] leading-[1.5] text-muted-foreground">
          Al comparar, mira cada modelo a un nivel de effort concreto. El mismo modelo en low y en
          max no cuesta ni rinde lo mismo.
        </p>
      </section>

      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} className="flex flex-col">
          <h2 className="border-b pb-2.5 font-mono text-[11.5px] text-muted-foreground">
            {grupo.titulo.toLowerCase()}
          </h2>
          <ul className="flex flex-col">
            {grupo.fuentes.map((f) => (
              <li key={f.nombre} className="border-b">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid gap-1 py-4 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6"
                >
                  <span className="font-heading text-[17px] font-semibold tracking-[-0.01em]">
                    {f.nombre}
                  </span>
                  <span className="flex flex-col gap-1 text-pretty text-[14px] leading-[1.5] text-muted-foreground">
                    {f.mide}
                    {f.nota ? (
                      <span className="font-mono text-[11.5px]">{f.nota}</span>
                    ) : null}
                  </span>
                  <ArrowUpRightIcon
                    aria-hidden
                    className="hidden size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground sm:block"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
