"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { EFFORTS } from "@/convex/schema";
import { METRICAS_ACTIVAS } from "@/convex/scoring/config";
import { COOKIE, RUTA, funciones } from "./conexion";

/**
 * Las acciones de /admin/preliminares.
 *
 * El token se pide una vez y queda en una cookie `httpOnly` limitada a /admin,
 * así que no viaja en la URL ni lo puede leer ningún script de la página. Esta
 * capa no decide nada: le pasa el token a Convex, que es quien sabe si vale
 * (ver `convex/admin/preliminares.ts`).
 */

type Resultado = { estado: string; error?: string; guardados?: number; modelKey?: string };

async function token() {
  return (await cookies()).get(COOKIE)?.value ?? "";
}

/** De vuelta a la página con una línea de aviso arriba. */
function volver(aviso: { ok?: string; error?: string }): never {
  const q = new URLSearchParams(aviso as Record<string, string>);
  redirect(`${RUTA}?${q}`);
}

function avisoDe(res: Resultado): never {
  if (res.estado === "apagada") volver({ error: "Falta REFRESCO_TOKEN en Convex." });
  if (res.estado === "denegada") volver({ error: "Token incorrecto." });
  if (res.estado === "invalido") volver({ error: res.error ?? "Datos inválidos." });
  volver({});
}

export async function entrar(formData: FormData) {
  const recibido = String(formData.get("token") ?? "").trim();
  const res = (await fetchQuery(funciones.listar, { token: recibido })) as Resultado;
  if (res.estado !== "ok") avisoDe(res);

  (await cookies()).set(COOKIE, recibido, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(RUTA);
}

export async function salir() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
  redirect(RUTA);
}

/** Un número del formulario, en porcentaje y con coma o punto. */
function porcentaje(crudo: FormDataEntryValue | null): number | undefined {
  const texto = String(crudo ?? "").trim().replace(",", ".").replace(/%$/, "");
  if (!texto) return undefined;
  return Number(texto) / 100;
}

export async function guardar(formData: FormData) {
  const effort = String(formData.get("effort") ?? "default");
  if (!(EFFORTS as readonly string[]).includes(effort)) volver({ error: "Effort desconocido." });

  const valores = METRICAS_ACTIVAS().flatMap((metric) => {
    const value = porcentaje(formData.get(metric));
    return value === undefined ? [] : [{ metric, value }];
  });

  const res = (await fetchMutation(funciones.guardar, {
    token: await token(),
    modelo: String(formData.get("modelo") ?? "").trim(),
    effort,
    fuenteUrl: String(formData.get("fuenteUrl") ?? "").trim() || undefined,
    measuredAt: String(formData.get("measuredAt") ?? "").trim() || undefined,
    valores,
  })) as Resultado;

  if (res.estado !== "ok") avisoDe(res);
  volver({
    ok: `${res.guardados} ${res.guardados === 1 ? "valor guardado" : "valores guardados"} para ${res.modelKey}@${effort}.`,
  });
}

export async function borrar(formData: FormData) {
  const res = (await fetchMutation(funciones.borrar, {
    token: await token(),
    id: String(formData.get("id") ?? ""),
  })) as Resultado;
  if (res.estado !== "ok") avisoDe(res);
  volver({ ok: "Preliminar borrado." });
}
