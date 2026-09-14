import { ImageResponse } from "next/og";
import { Marca } from "@/lib/marca";

/**
 * El icono de la pestaña, dibujado en cada build en vez de guardado como
 * archivo. Así el día que los colores de las tarjetas cambien, el icono cambia
 * con ellos y no se queda enseñando la paleta del año pasado.
 *
 * `force-static`: el layout pone toda la web en dinámico porque sus datos salen
 * de Convex y no se pueden cachear, pero este dibujo no depende de ningún dato.
 * Sin esto, cada pestaña que se abriera lo volvería a generar.
 */
export const dynamic = "force-static";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<Marca lado={size.width} />, { ...size });
}
