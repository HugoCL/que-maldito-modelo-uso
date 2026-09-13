/**
 * Todas las cadenas visibles, en un solo sitio.
 *
 * La app es en español porque el nombre lo pide, pero nada en los componentes
 * tiene texto incrustado: añadir inglés es escribir un archivo hermano de este
 * y elegir cuál importar.
 */
export const es = {
  marca: {
    // Dos nombres a propósito. El de la pestaña y el de los buscadores va
    // censurado; el del titular no, porque ahí la palabrota se tapa sola cada
    // pocos segundos y un asterisco fijo le quitaría la gracia.
    nombre: "Qué m*ldito modelo uso",
    nombreEntero: "Qué maldito modelo uso",
    palabrota: "maldito",
    nombreCorto: "qmmu",
    lema: "Tres respuestas, actualizadas solas. Sin tablas de cuarenta filas.",
  },
  nav: {
    inicio: "Inicio",
    metodologia: "Metodología",
    creditos: "Créditos",
    estado: "Estado",
  },
  // Cada tier aparece en dos sitios con dos voces: `etiqueta`/`nota` en la
  // columna izquierda de la portada, en minúscula y monoespaciada, y
  // `titulo`/`subtitulo` cuando hay sitio para una frase entera.
  tiers: {
    barato: {
      orden: "01",
      etiqueta: "barato",
      nota: "bajo riesgo",
      titulo: "Barato",
      subtitulo: "Mantenimiento y bajo riesgo",
      descripcion: "Renombrar, tests, boilerplate, arreglos pequeños.",
    },
    dia_a_dia: {
      orden: "02",
      etiqueta: "día a día",
      nota: "recomendado",
      titulo: "Día a día",
      subtitulo: "El que dejas puesto",
      descripcion: "La mejor relación entre lo que rinde y lo que cuesta.",
    },
    bueno: {
      orden: "03",
      etiqueta: "uno bueno",
      nota: "sin mirar precio",
      titulo: "Necesito uno bueno",
      subtitulo: "Sin mirar el precio",
      descripcion: "Cuando la tarea es difícil y el costo da igual.",
    },
  },
  tarjeta: {
    calidad: "Calidad",
    costo: "Costo por tarea",
    costoMedido: "medido",
    costoEstimado: "estimado",
    alternativa: "Alternativa",
    effort: "effort",
    sinEffort: "sin niveles de effort",
    verFicha: "Ver ficha",
    confianza: {
      alta: "Confianza alta",
      media: "Confianza media",
      baja: "Confianza baja",
    },
    medidoPor: "Medido por",
    disponibleEn: "Disponible en",
    pesosAbiertos: "Pesos abiertos",
  },
  filtros: {
    titulo: "¿Para qué lo quieres?",
    perfil: "Tipo de tarea",
    presupuesto: "Máximo por tarea",
    // Las dos etiquetas de la portada van en minúscula: la barra de filtros es
    // una línea, no un formulario.
    tarea: "tipo de tarea",
    maxPorTarea: "tope por tarea",
    sinTechoCorto: "sin tope",
    // Debajo de la barra, en una línea: qué está haciendo cada control ahora
    // mismo. Los nombres de los benchmarks salen del perfil elegido, así que
    // encender o apagar una fuente cambia esta frase sola.
    puntuaCon: (benchmarks: string) => `Puntúa con ${benchmarks}`,
    conTope: (tope: string) => `nada por encima de $${tope} la tarea`,
    sinTecho: "sin techo",
    soloOpenWeights: "Solo pesos abiertos",
    proveedor: "Proveedor",
    cualquiera: "Cualquiera",
    limpiar: "Quitar filtros",
    recalculando: "Recalculando…",
  },
  estado: {
    actualizado: "Actualizado",
    nunca: "todavía sin corridas",
    modoSemilla: "Datos de ejemplo",
    modoSemillaDetalle:
      "Sin despliegue de Convex conectado: lo que ves es una instantánea del pipeline del",
    fuentes: "Fuentes",
    sinResolver: "Nombres sin resolver",
    corridas: "Últimas corridas",
    listo: "listo",
    enCurso: "en curso…",
    enCola: "en cola",
    fallo: "falló",
    apagada: "apagada",
    sinCorridas: "sin corridas todavía",
  },
  portada: {
    calidad: "calidad",
    porTarea: "/tarea",
    deCien: "/100",
    pieDeTabla: (benchmarks: number) =>
      `calidad ponderada por ${benchmarks} benchmarks · costo medido por tarea`,
    ejes: (enFrontera: number) => `calidad × costo · ${enFrontera} variantes en la frontier`,
    ejesCorto: (enFrontera: number) => `calidad × costo · ${enFrontera} variantes`,
    bajoElTecho: "bajo el techo",
    alternativas: (n: number) => (n === 1 ? "1 alternativa" : `${n} alternativas`),
    sinAcceso: "Otras respuestas a esta misma pregunta, por si no puedes usar la recomendada",
    faltanRespuestas:
      "Con estos benchmarks no hay datos para las tres respuestas: solo salen las que se pueden defender.",
    sinDatosDeCosto: "sin costo medido",
  },
  vacio: {
    titulo: "Ningún modelo pasa esos filtros",
    descripcion:
      "Con esas restricciones no queda nada medido por suficientes benchmarks. Prueba a subir el techo de costo o a quitar el filtro de proveedor.",
  },
  generico: {
    porTarea: "/tarea",
    porMillon: "por millón de tokens",
    contexto: "Contexto",
    salida: "Salida máx.",
    entrada: "Entrada",
    cacheLectura: "Lectura de caché",
    publicado: "Publicado",
    corte: "Corte de conocimiento",
    volver: "Volver",
    entradaSalida: "Entrada / salida",
    effort: "effort",
    sinMedir: "Ningún benchmark de los que seguimos ha medido este modelo todavía.",
  },
} as const;

export type Textos = typeof es;
