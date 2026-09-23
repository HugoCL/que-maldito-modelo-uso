import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

/**
 * Relanza el pipeline entero —catálogos y benchmarks— sin esperar al cron.
 *
 * No la enlaza ninguna página ni la lista ningún mapa del sitio: es para quien
 * sepa que existe y tenga el token. El token viaja como
 * `Authorization: Bearer <token>` o, para poder abrirla desde el navegador,
 * como `?token=`. `?forzar=1` rehace el parseo aunque ninguna fuente haya
 * cambiado, que es lo que hace falta después de arreglar un parser.
 *
 * Quien decide si el token vale es Convex, no esta ruta (ver
 * `convex/ingest/refresco.ts`): el secreto vive en un solo sitio.
 */

const pedir = makeFunctionReference<"mutation">("ingest/refresco:pedir");

type Respuesta =
  | { estado: "apagada" }
  | { estado: "denegada" }
  | { estado: "en_curso"; desde: number }
  | { estado: "encargada" };

const CABECERAS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function responder(status: number, cuerpo: Record<string, unknown>) {
  return Response.json(cuerpo, { status, headers: CABECERAS });
}

async function refrescar(request: Request) {
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer ?? url.searchParams.get("token") ?? "";
  const forzar = ["1", "true", "si", "sí"].includes(url.searchParams.get("forzar") ?? "");

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return responder(503, { error: "Esta web corre sin Convex: no hay pipeline que relanzar." });
  }

  let res: Respuesta;
  try {
    res = (await fetchMutation(pedir, { token, forzar })) as Respuesta;
  } catch (err) {
    console.error("No se pudo encargar el run:", err);
    return responder(502, { error: "Convex no respondió." });
  }

  switch (res.estado) {
    case "apagada":
      return responder(503, { error: "El refresco está apagado: falta REFRESCO_TOKEN en Convex." });
    case "denegada":
      return responder(401, { error: "Token incorrecto." });
    case "en_curso":
      return responder(409, {
        estado: "en_curso",
        desde: new Date(res.desde).toISOString(),
        mensaje: "Ya hay un run en marcha. Se puede seguir en /estado.",
      });
    case "encargada":
      return responder(202, {
        estado: "encargada",
        forzar,
        mensaje: "Run encargado. Se puede seguir en /estado.",
      });
  }
}

export const GET = refrescar;
export const POST = refrescar;
