import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * El titular dice la palabrota entera, y cada pocos segundos alguien la tapa.
 *
 * Las letras se caen una detrás de otra y en su sitio aparecen los símbolos de
 * tebeo; un segundo después vuelven. No es un estado, es algo que pasa: el
 * nombre se lee normal casi todo el tiempo.
 *
 * Los símbolos no van uno por letra sino en su propia fila centrada encima de
 * la palabra. Una `%` sobre una `l` no cabe, y emparejarlos obligaría a medir
 * cada letra; así cada fila se coloca sola y la que manda en el ancho de la
 * línea es la de las letras, que no se mueve.
 *
 * Todo es CSS: esto se sirve desde el servidor como el resto de la portada, sin
 * hidratación y sin un hueco esperando al JavaScript. Los símbolos se dibujan
 * con `content`, no con texto, así que el titular de la página sigue diciendo
 * exactamente el nombre, lo mismo que lee un lector de pantalla, lo que se
 * copia al portapapeles y lo que ve un buscador.
 */
const SIMBOLOS = ["@", "#", "%", "&", "$", "!"];

export function TituloMutante({
  texto,
  palabra,
  className,
}: {
  texto: string;
  palabra: string;
  className?: string;
}) {
  const corte = texto.indexOf(palabra);
  if (corte === -1) return <h1 className={className}>{texto}</h1>;

  return (
    <h1 className={cn("titulo-mutante", className)}>
      {texto.slice(0, corte)}
      {/* La palabra no se parte en dos líneas: cada letra es su propia caja y
          sin esto el salto de línea podría caer en medio. */}
      <span className="palabra">
        {[...palabra].map((letra, i) => (
          // El retraso de cada letra es lo que hace que la palabra se tape en
          // cascada y no de golpe.
          <span key={i} className="letra" style={{ "--i": i } as CSSProperties}>
            {letra}
          </span>
        ))}
        <span className="palabrota" aria-hidden>
          {SIMBOLOS.map((s, i) => (
            <span key={s} className="simbolo" data-simbolo={s} style={{ "--i": i } as CSSProperties} />
          ))}
        </span>
      </span>
      {texto.slice(corte + palabra.length)}
    </h1>
  );
}
