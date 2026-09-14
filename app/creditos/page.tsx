import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerMetodologia } from "@/lib/datos";

export const metadata = { title: "Créditos" };

/**
 * Este sitio no mide nada: cruza el trabajo de otros. La atribución es lo
 * mínimo, y en varios casos es además una condición de uso.
 */
export default async function Creditos() {
  const { fuentes } = await obtenerMetodologia();
  const activas = fuentes.filter((f) => f.activa);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">Créditos</h1>
        <p className="text-pretty text-muted-foreground">
          Aquí no se corre ningún benchmark. Todo el mérito de los números es de quien los midió;
          lo único que ponemos nosotros es el cruce. Si algo está mal, lo más probable es que el
          error sea nuestro al combinarlos.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-semibold">Fuentes en uso</h2>
        <div className="flex flex-col gap-4">
          {activas.map((f) => (
            <Card key={f.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  <a
                    href={f.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                  >
                    {f.nombre}
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                </CardTitle>
                <CardDescription>{f.atribucion}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{f.licencia}</p>
                {f.nota ? <p className="text-sm text-muted-foreground">{f.nota}</p> : null}
                <Badge variant="outline" className="w-fit font-mono text-[11px]">
                  {f.tipo}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 text-sm text-muted-foreground">
        <h2 className="font-heading text-base font-semibold text-foreground">Cómo leemos</h2>
        <p>
          Una descarga al día por fuente, con un User-Agent que dice quiénes somos. No entrenamos
          nada con estos datos ni los revendemos: se muestran con enlace a su origen para que
          cualquiera pueda ir a comprobarlos. Si mantienes alguna de estas fuentes y prefieres que
          no la leamos así, escríbenos y la quitamos.
        </p>
      </section>
    </main>
  );
}
