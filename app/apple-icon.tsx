import { ImageResponse } from "next/og";
import { Marca } from "@/lib/marca";

/**
 * El mismo dibujo para la pantalla de inicio de un teléfono. 180 píxeles es lo
 * que pide iOS, y como la marca está en porcentajes del lado no hay que tocar
 * nada más que este número.
 */
export const dynamic = "force-static";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Marca lado={size.width} />, { ...size });
}
