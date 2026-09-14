import { THRESHOLDS } from "./config";

export type Tier = "barato" | "dia_a_dia" | "bueno";

/**
 * Lo único que esta selección necesita saber de una variante.
 *
 * Deliberadamente no es `Scored`: elegir las tres respuestas no mira el
 * desglose por benchmark ni los precios de lista, solo calidad, incertidumbre,
 * cobertura y costo. Escribirlo así deja que la web corra exactamente la misma
 * función sobre la instantánea de `lib/datos-semilla.ts` que Convex corre
 * sobre la base, y que un filtro dé la misma respuesta en los dos sitios, que
 * es la única forma de que la metodología signifique algo.
 */
export type Elegible = {
  modelName: string;
  effort: string;
  quality: number;
  qualityLo: number;
  qualityHi: number;
  benchmarks: number;
  cost?: number;
};

export type Recomendacion<T extends Elegible = Elegible> = {
  tier: Tier;
  ganador: T;
  /**
   * Suplentes de esa misma tarjeta, elegidas con el mismo criterio que el
   * ganador y ordenadas de mejor a peor. Existen porque "el mejor" no sirve de
   * nada si tu empresa no tiene contrato con ese proveedor: lo que hace falta
   * entonces no es el segundo mejor de la lista general, sino el siguiente que
   * contesta *esta* pregunta.
   *
   * Nunca incluyen a los ganadores de las otras dos tarjetas: si te mando a la
   * respuesta de al lado, la tarjeta sobra.
   */
  alternativas: T[];
  razon: string;
  /** La misma explicación en una línea, para la fila de la portada. */
  razonCorta: string;
};

/** Cuántas suplentes se guardan por tarjeta. */
export const MAX_ALTERNATIVAS = 3;

/**
 * Quién puede competir por una tarjeta.
 *
 * Pedir dos benchmarks no es cosmético: sin esa regla, un modelo medido por
 * uno solo, el que mejor le venga, sale con calidad 100 y se cuela por delante
 * de otro medido por tres. Los que no llegan siguen visibles en su ficha, con
 * su etiqueta de confianza baja; lo que no hacen es ser la respuesta.
 *
 * `minimo` existe porque la web deja bajarlo a uno a propósito, para ver el
 * conjunto entero. Es lo único que abre la puerta a los 39 que hoy se quedan
 * fuera: elegir qué benchmarks cuentan no puede, porque apagar una fuente solo
 * puede bajarle la cuenta a una variante y nunca subírsela.
 */
export function elegibles<T extends Elegible>(
  scored: T[],
  minimo: number = THRESHOLDS.benchmarksMinimos,
): T[] {
  return scored.filter((s) => s.cost !== undefined && s.benchmarks >= minimo);
}

/**
 * Frontera de Pareto sobre (calidad ↑, costo ↓).
 *
 * Una variante dominada, con alguien mejor Y más barato que ella, no puede
 * ser la respuesta a ninguna de las tres preguntas, así que se descarta antes de
 * elegir. Esto solo deja los intercambios reales.
 */
export function paretoFrontier<T extends Elegible>(items: T[]): T[] {
  const conCosto = items.filter((i) => i.cost !== undefined);
  return conCosto.filter(
    (a) =>
      !conCosto.some(
        (b) =>
          b !== a &&
          b.quality >= a.quality &&
          b.cost! <= a.cost! &&
          (b.quality > a.quality || b.cost! < a.cost!),
      ),
  );
}

/** Dos variantes cuyos intervalos se tocan no son distinguibles en calidad. */
export function empatanEstadisticamente(a: Elegible, b: Elegible): boolean {
  return a.qualityLo <= b.qualityHi && b.qualityLo <= a.qualityHi;
}

function percentil(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((x, y) => x - y);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))));
  return s[idx];
}

/**
 * Exceso de cada punto sobre la cuerda que une los dos extremos de la
 * frontera: cuánta calidad da de más comparado con interpolar linealmente
 * entre el más barato y el mejor.
 *
 * El eje de costo va en logaritmo a propósito: la diferencia entre $1 y $2 pesa
 * lo mismo que entre $8 y $16, que es como se siente pagar.
 *
 * El signo importa. Un punto POR DEBAJO de la cuerda es peor que interpolar y
 * nunca es un codo, por muy lejos que esté de la recta; medir la distancia en
 * valor absoluto los premiaría exactamente al revés.
 */
export function excesoSobreLaCuerda<T extends Elegible>(frontier: T[]): Map<T, number> {
  const out = new Map<T, number>();
  if (frontier.length < 2) {
    for (const s of frontier) out.set(s, 0);
    return out;
  }

  const pts = frontier
    .map((s) => ({ s, x: Math.log10(Math.max(s.cost!, 0.01)), y: s.quality }))
    .sort((a, b) => a.x - b.x);

  const first = pts[0];
  const last = pts[pts.length - 1];
  const dx = last.x - first.x;
  if (dx === 0) {
    for (const p of pts) out.set(p.s, 0);
    return out;
  }
  const pendiente = (last.y - first.y) / dx;

  for (const p of pts) {
    const cuerda = first.y + pendiente * (p.x - first.x);
    out.set(p.s, p.y - cuerda);
  }
  return out;
}

/**
 * El codo: el punto que más se despega hacia arriba de esa cuerda. Es donde
 * dejar de pagar más empieza a no comprar calidad.
 *
 * La geometría se calcula siempre sobre la frontera completa, aunque después
 * elijamos solo entre los que pasan el piso de calidad: si se recortara antes,
 * la cuerda cambiaría de inclinación y el "codo" acabaría siendo simplemente el
 * más barato de los que quedan.
 */
export function codoDeLaFrontera<T extends Elegible>(
  frontier: T[],
  elegirEntre?: T[],
): T | undefined {
  if (frontier.length === 0) return undefined;
  const exceso = excesoSobreLaCuerda(frontier);
  const pool = elegirEntre ?? frontier;
  if (pool.length === 0) return undefined;

  return pool.reduce((mejor, s) => {
    const a = exceso.get(s) ?? -Infinity;
    const b = exceso.get(mejor) ?? -Infinity;
    if (a > b) return s;
    // Empate en forma: gana el más barato.
    if (a === b && s.cost! < mejor.cost!) return s;
    return mejor;
  }, pool[0]);
}

const dinero = (n: number) => `$${n.toFixed(2)}`;

/** El effort forma parte de la identidad: "Opus 5" y "Opus 5 max" no son lo mismo. */
const nombre = (s: Elegible) =>
  s.effort === "default" ? s.modelName : `${s.modelName} (${s.effort})`;

function razonBueno(g: Elegible, lider: Elegible): string {
  const base = `Es lo más capaz que hay ahora mismo: ${g.quality.toFixed(0)} de calidad`;
  if (g !== lider && empatanEstadisticamente(g, lider)) {
    return `${base}, empatado con ${nombre(lider)} dentro del margen de error y ${dinero(
      lider.cost! - g.cost!,
    )} más barato por tarea.`;
  }
  return `${base}${
    g.cost !== undefined ? `, a ${dinero(g.cost)} por tarea` : ""
  }. Si el presupuesto no es el problema, este.`;
}

function razonBarato(g: Elegible, lider: Elegible): string {
  const pct = Math.round((g.quality / lider.quality) * 100);
  const veces = g.cost && lider.cost ? lider.cost / g.cost : undefined;
  return (
    `${dinero(g.cost!)} por tarea` +
    (veces ? `, ${veces.toFixed(0)}× más barato que ${nombre(lider)}` : "") +
    `, y conserva el ${pct}% de su calidad. Para renombrar, tests, boilerplate y arreglos de bajo riesgo.`
  );
}

function razonDiaADia(g: Elegible, lider: Elegible): string {
  const pct = Math.round((g.quality / lider.quality) * 100);
  const ahorro = g.cost && lider.cost ? lider.cost - g.cost : undefined;
  return (
    `El punto donde pagar más deja de comprar calidad: ${pct}% de lo que da ${nombre(lider)}` +
    (ahorro && ahorro > 0 ? ` por ${dinero(ahorro)} menos por tarea` : "") +
    `. El que dejarías puesto por defecto.`
  );
}

/**
 * Las mismas razones en una línea.
 *
 * La portada enseña calidad y costo en su propia columna, así que la frase de
 * al lado no los repite: dice la comparación que el número suelto no cuenta,
 * cuántas veces más barato o cuánto se ahorra, y nada más.
 */
function razonCortaBarato(g: Elegible, lider: Elegible): string {
  const pct = Math.round((g.quality / lider.quality) * 100);
  const veces = g.cost && lider.cost ? lider.cost / g.cost : undefined;
  return veces
    ? `${veces.toFixed(0)}× más barato que el líder, con el ${pct}% de su calidad.`
    : `${pct}% de la calidad del líder. Para el trabajo de bajo riesgo.`;
}

function razonCortaDiaADia(g: Elegible, lider: Elegible): string {
  const pct = Math.round((g.quality / lider.quality) * 100);
  const ahorro = g.cost !== undefined && lider.cost !== undefined ? lider.cost - g.cost : undefined;
  return ahorro && ahorro > 0
    ? `${pct}% del líder por ${dinero(ahorro)} menos. Este es el que dejas puesto.`
    : `Donde pagar más deja de comprar calidad. Este es el que dejas puesto.`;
}

function razonCortaBueno(g: Elegible, lider: Elegible): string {
  if (g !== lider && empatanEstadisticamente(g, lider)) {
    return `Empata con ${nombre(lider)} y cuesta ${dinero(lider.cost! - g.cost!)} menos.`;
  }
  return "Lo más capaz que hay medido. Y se nota en la factura.";
}

/**
 * Las tres respuestas.
 *
 * Ninguna es curada a mano: salen de la frontera, del codo y de los pisos de
 * calidad definidos en config.ts. Si el resultado sorprende, lo que hay que
 * discutir son los pesos, no el código.
 */
export function elegirTarjetas<T extends Elegible>(
  scored: T[],
  minimo: number = THRESHOLDS.benchmarksMinimos,
): Recomendacion<T>[] {
  const pool = elegibles(scored, minimo);
  if (pool.length === 0) return [];

  const frontier = paretoFrontier(pool);
  const porCalidad = [...pool].sort((a, b) => b.quality - a.quality);
  const lider = porCalidad[0];

  // BUENO: el mejor; si varios empatan dentro del margen de error, el más
  // barato de ellos. Perseguir décimas que el intervalo no distingue sería
  // fingir una precisión que los benchmarks no tienen.
  const empatados = porCalidad.filter((s) => empatanEstadisticamente(s, lider));
  const bueno = empatados.reduce((a, b) => (a.cost! <= b.cost! ? a : b), empatados[0]);

  // BARATO: el mejor del tercio más económico, con piso de calidad para no
  // recomendar algo que va a costar más caro en revisiones.
  //
  // La condición de ser más barato que `bueno` es parte de la elección, no un
  // arreglo posterior: si "barato" pudiera costar más que "uno bueno", las tres
  // tarjetas dejarían de ser tres puntos de un mismo intercambio y pasarían a
  // ser tres respuestas sueltas que se contradicen. Cuando ningún candidato la
  // cumple, esta tarjeta no sale, que es más honesto que enseñar dos veces el
  // mismo modelo.
  const corte = percentil(
    pool.map((s) => s.cost!),
    THRESHOLDS.percentilCostoBarato,
  );
  const candidatosBaratos = frontier.filter(
    (s) =>
      s !== bueno &&
      s.cost! < bueno.cost! &&
      s.quality >= lider.quality * THRESHOLDS.pisoCalidadBarato,
  );
  const barato =
    candidatosBaratos.filter((s) => s.cost! <= corte).sort((a, b) => b.quality - a.quality)[0] ??
    // Si nadie del tercio barato pasa el piso, se afloja al más barato que sí.
    [...candidatosBaratos].sort((a, b) => a.cost! - b.cost!)[0];

  // DÍA A DÍA: el codo, elegido entre los que pasan el piso alto pero medido
  // contra la frontera entera.
  //
  // El techo de `bueno` no es decorativo. Cuando el líder tiene un intervalo
  // ancho, la regla de empate estadístico puede darle la tarjeta "bueno" a una
  // variante bastante más barata y con menos calidad de punto, y entonces el
  // codo, que no sabe nada de eso, elegiría algo mejor que "lo mejor". Las
  // tarjetas dejarían de significar lo que dicen.
  const candidatosDiarios = frontier.filter(
    (s) =>
      s !== bueno &&
      s !== barato &&
      s.quality >= lider.quality * THRESHOLDS.pisoCalidadDiaADia &&
      s.quality <= bueno.quality &&
      s.cost! <= bueno.cost! &&
      (barato === undefined || s.cost! >= barato.cost!),
  );
  const diaADia = codoDeLaFrontera(frontier, candidatosDiarios);

  // Las suplentes de cada tarjeta se eligen con el MISMO criterio que su
  // ganador. Si no, la segunda opción de "día a día" acaba siendo el modelo más
  // barato de todos, que es justamente la respuesta de la otra tarjeta.
  const exceso = excesoSobreLaCuerda(frontier);
  const ganadores = new Set([barato, diaADia, bueno].filter(Boolean) as T[]);
  const suplentes = (candidatas: T[]) =>
    candidatas.filter((s) => !ganadores.has(s)).slice(0, MAX_ALTERNATIVAS);

  const out: Recomendacion<T>[] = [];

  if (barato) {
    out.push({
      tier: "barato",
      ganador: barato,
      alternativas: suplentes([...candidatosBaratos].sort((a, b) => a.cost! - b.cost!)),
      razon: razonBarato(barato, lider),
      razonCorta: razonCortaBarato(barato, lider),
    });
  }

  if (diaADia) {
    out.push({
      tier: "dia_a_dia",
      ganador: diaADia,
      alternativas: suplentes(
        [...candidatosDiarios].sort((a, b) => (exceso.get(b) ?? 0) - (exceso.get(a) ?? 0)),
      ),
      razon: razonDiaADia(diaADia, lider),
      razonCorta: razonCortaDiaADia(diaADia, lider),
    });
  }

  out.push({
    tier: "bueno",
    ganador: bueno,
    alternativas: suplentes([...frontier].sort((a, b) => b.quality - a.quality)),
    razon: razonBueno(bueno, lider),
    razonCorta: razonCortaBueno(bueno, lider),
  });

  return out;
}
