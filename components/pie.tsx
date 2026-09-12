import Link from "next/link";
import { obtenerMetodologia } from "@/lib/datos";

/**
 * La atribución no es cortesía: varias fuentes la piden explícitamente y
 * ninguna nos debe nada. El pie sale de la misma lista de fuentes que usa el
 * pipeline, así que añadir una fuente y olvidarse de acreditarla es imposible.
 */
export async function Pie() {
  const { fuentes } = await obtenerMetodologia();
  const activas = fuentes.filter((f) => f.activa);

  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground">
        <p>
          Datos de{" "}
          {activas.map((f, i) => (
            <span key={f.id}>
              <a
                href={f.homepage}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline-offset-4 hover:underline"
              >
                {f.nombre}
              </a>
              {i < activas.length - 1 ? ", " : ""}
            </span>
          ))}
          . Cada uno mantiene su propio benchmark; aquí solo se cruzan.
        </p>
        <p>
          <Link href="/creditos" className="underline-offset-4 hover:underline">
            Créditos y licencias
          </Link>
          {" · "}
          <Link href="/metodologia" className="underline-offset-4 hover:underline">
            Cómo se calcula
          </Link>
        </p>
      </div>
    </footer>
  );
}
