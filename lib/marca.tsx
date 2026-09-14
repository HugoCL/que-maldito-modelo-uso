/**
 * La marca del sitio: el asterisco de la censura, en los tres colores.
 *
 * El nombre se escribe «Qué m*ldito modelo uso» y el titular de la portada tapa
 * la palabrota cada pocos segundos. Ese asterisco es lo único que este sitio
 * tiene y no tiene nadie más, así que es lo que va en el icono. Tres barras
 * cruzadas, una por cada respuesta y con el color de su tarjeta: la censura
 * dice de qué va el nombre y los colores dicen de qué va la web.
 *
 * Aquí hubo una curva con tres puntos, que era el gráfico de la portada en
 * pequeño. Se quitó porque a dieciséis píxeles no se distinguía de cualquier
 * otro icono de analítica; esto no se confunde con nada.
 *
 * Cada barra lleva detrás un halo del color del fondo, y como se dibujan por
 * turnos (halo, barra, halo, barra…) cada una recorta un hueco en la anterior.
 * Es el mismo recurso con el que los puntos del gráfico se separan cuando caen
 * uno encima de otro, y es lo que evita que el cruce se lea como una mancha.
 * Por eso el fondo es plano y no un degradado: el halo tiene que ser exactamente
 * del color que hay debajo.
 *
 * No lleva texto a propósito. `ImageResponse` dibuja con Satori, que exige una
 * fuente en cuanto hay una letra; sin texto no hace falta ninguna, así que el
 * icono se genera sin descargar nada y no puede romperse porque una fuente no
 * esté disponible en el build.
 *
 * Todo va en porcentajes del lado, así que el mismo dibujo sirve para los 32
 * píxeles de la pestaña y para los 180 de la pantalla de inicio de un teléfono.
 */

/** El casi negro del tema oscuro. Plano, para que el halo cuadre. */
const FONDO = "#0b0b10";

/**
 * Los tres brazos. Los colores son los de las tarjetas en modo oscuro, que
 * están medidos: pasan la banda de luminosidad, el suelo de croma y la
 * separación bajo daltonismo contra un fondo casi negro. Ver app/globals.css.
 *
 * El azul de la marca va el último para quedar por encima en el cruce.
 */
const BRAZOS = [
  { angulo: 150, color: "#ce7600" },
  { angulo: 30, color: "#00ad71" },
  { angulo: 90, color: "#3890d2" },
];

const LARGO = 74;
const GROSOR = 13;
const SEPARACION = 2.6;
const RADIO = 23;

export function Marca({ lado }: { lado: number }) {
  /** De porcentaje del lado a píxeles. */
  const u = (p: number) => (p / 100) * lado;

  const largo = u(LARGO);
  const grosor = Math.max(2, u(GROSOR));
  // A 16 píxeles la separación no llega ni a un píxel; antes que dibujar una
  // línea gris de medio píxel, no se dibuja.
  const separacion = u(SEPARACION) >= 1 ? u(SEPARACION) : 0;

  const barra = (angulo: number, color: string, crecer: number) => (
    <div
      style={{
        position: "absolute",
        left: lado / 2 - (largo + crecer * 2) / 2,
        top: lado / 2 - (grosor + crecer * 2) / 2,
        width: largo + crecer * 2,
        height: grosor + crecer * 2,
        borderRadius: grosor + crecer * 2,
        background: color,
        transform: `rotate(${angulo}deg)`,
      }}
    />
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: lado,
        height: lado,
        borderRadius: u(RADIO),
        background: FONDO,
      }}
    >
      {BRAZOS.map((b) => (
        <div key={b.angulo} style={{ position: "absolute", display: "flex", width: lado, height: lado }}>
          {separacion > 0 ? barra(b.angulo, FONDO, separacion) : null}
          {barra(b.angulo, b.color, 0)}
        </div>
      ))}
    </div>
  );
}
