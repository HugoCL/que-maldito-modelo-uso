import { THRESHOLDS } from "./config";
import type { Scored } from "./compute";

export type Tier = "barato" | "dia_a_dia" | "bueno";

export type Recomendacion = {
  tier: Tier;
  ganador: Scored;
  segundo?: Scored;
  razon: string;
};

/**
 * Quién puede competir por una tarjeta.
 *
 * El filtro de cobertura no es cosmético: sin él, un modelo medido por un solo
 * benchmark —el más débil de los cinco— puede salir con calidad 100 y colarse
 * en la frontera por delante de otro medido por cuatro. Los que no llegan
 * siguen visibles en el comparador y en su ficha, con su etiqueta de confianza
 * baja; lo que no hacen es ser la respuesta.
 */
export function elegibles(scored: Scored[]): Scored[] {
  return scored.filter(
    (s) => s.cost !== undefined && s.coverage >= THRESHOLDS.coberturaMinima,
  );
}

/**
 * Frontera de Pareto sobre (calidad ↑, costo ↓).
 *
 * Una variante dominada —alguien es mejor Y más barato— no puede ser la
 * respuesta a ninguna de las tres preguntas, así que se descarta antes de
 * elegir. Esto solo deja los intercambios reales.
 */
export function paretoFrontier(items: Scored[]): Scored[] {
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
export function empatanEstadisticamente(a: Scored, b: Scored): boolean {
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
export function excesoSobreLaCuerda(frontier: Scored[]): Map<Scored, number> {
  const out = new Map<Scored, number>();
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
export function codoDeLaFrontera(
  frontier: Scored[],
  elegirEntre?: Scored[],
): Scored | undefined {
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
const nombre = (s: Scored) =>
  s.effort === "default" ? s.modelName : `${s.modelName} (${s.effort})`;

function razonBueno(g: Scored, lider: Scored): string {
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

function razonBarato(g: Scored, lider: Scored): string {
  const pct = Math.round((g.quality / lider.quality) * 100);
  const veces = g.cost && lider.cost ? lider.cost / g.cost : undefined;
  return (
    `${dinero(g.cost!)} por tarea` +
    (veces ? `, ${veces.toFixed(0)}× más barato que ${nombre(lider)}` : "") +
    `, y conserva el ${pct}% de su calidad. Para renombrar, tests, boilerplate y arreglos de bajo riesgo.`
  );
}

function razonDiaADia(g: Scored, lider: Scored): string {
  const pct = Math.round((g.quality / lider.quality) * 100);
  const ahorro = g.cost && lider.cost ? lider.cost - g.cost : undefined;
  return (
    `El punto donde pagar más deja de comprar calidad: ${pct}% de lo que da ${nombre(lider)}` +
    (ahorro && ahorro > 0 ? ` por ${dinero(ahorro)} menos por tarea` : "") +
    `. El que dejarías puesto por defecto.`
  );
}

/**
 * Las tres respuestas.
 *
 * Ninguna es curada a mano: salen de la frontera, del codo y de los pisos de
 * calidad definidos en config.ts. Si el resultado sorprende, lo que hay que
 * discutir son los pesos, no el código.
 */
export function elegirTarjetas(scored: Scored[]): Recomendacion[] {
  const pool = elegibles(scored);
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
  const corte = percentil(
    pool.map((s) => s.cost!),
    THRESHOLDS.percentilCostoBarato,
  );
  const sobreElPiso = frontier.filter(
    (s) => s.quality >= lider.quality * THRESHOLDS.pisoCalidadBarato,
  );
  const barato =
    sobreElPiso.filter((s) => s.cost! <= corte).sort((a, b) => b.quality - a.quality)[0] ??
    // Si nadie del tercio barato pasa el piso, se afloja al más barato que sí.
    [...sobreElPiso].sort((a, b) => a.cost! - b.cost!)[0];

  // DÍA A DÍA: el codo, elegido entre los que pasan el piso alto pero medido
  // contra la frontera entera.
  //
  // El techo de `bueno` no es decorativo. Cuando el líder tiene un intervalo
  // ancho, la regla de empate estadístico puede darle la tarjeta "bueno" a una
  // variante bastante más barata y con menos calidad de punto — y entonces el
  // codo, que no sabe nada de eso, elegiría algo mejor que "lo mejor". Las
  // tarjetas dejarían de significar lo que dicen.
  const candidatosDiarios = frontier.filter(
    (s) =>
      s !== bueno &&
      s.quality >= lider.quality * THRESHOLDS.pisoCalidadDiaADia &&
      s.quality <= bueno.quality,
  );
  let diaADia = codoDeLaFrontera(frontier, candidatosDiarios) ?? codoDeLaFrontera(frontier);

  // Las tres respuestas tienen que ser tres respuestas distintas.
  if (diaADia && (diaADia === bueno || diaADia === barato)) {
    diaADia = codoDeLaFrontera(
      frontier,
      candidatosDiarios.filter((s) => s !== bueno && s !== barato),
    );
  }

  // La alternativa de cada tarjeta se elige con el MISMO criterio que su
  // ganador. Si no, la segunda opción de "día a día" acaba siendo el modelo más
  // barato de todos, que es justamente la respuesta de la otra tarjeta.
  const exceso = excesoSobreLaCuerda(frontier);
  const out: Recomendacion[] = [];

  if (barato) {
    out.push({
      tier: "barato",
      ganador: barato,
      segundo: sobreElPiso
        .filter((s) => s !== barato)
        .sort((a, b) => a.cost! - b.cost!)[0],
      razon: razonBarato(barato, lider),
    });
  }

  if (diaADia) {
    out.push({
      tier: "dia_a_dia",
      ganador: diaADia,
      segundo: candidatosDiarios
        .filter((s) => s !== diaADia && s !== bueno)
        .sort((a, b) => (exceso.get(b) ?? 0) - (exceso.get(a) ?? 0))[0],
      razon: razonDiaADia(diaADia, lider),
    });
  }

  out.push({
    tier: "bueno",
    ganador: bueno,
    segundo: porCalidad.filter((s) => s !== bueno)[0],
    razon: razonBueno(bueno, lider),
  });

  return out;
}
