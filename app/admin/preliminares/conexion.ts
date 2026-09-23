import { makeFunctionReference } from "convex/server";

/**
 * Lo que comparten la página y sus acciones. Va aparte porque un archivo
 * `"use server"` solo puede exportar funciones asíncronas.
 */

/** La cookie donde queda el token. Ver `acciones.ts`. */
export const COOKIE = "qmmu_admin";

export const RUTA = "/admin/preliminares";

// Por nombre y no desde convex/_generated, por lo mismo que en lib/datos.ts.
export const funciones = {
  listar: makeFunctionReference<"query">("admin/preliminares:listar"),
  guardar: makeFunctionReference<"mutation">("admin/preliminares:guardar"),
  borrar: makeFunctionReference<"mutation">("admin/preliminares:borrar"),
};
