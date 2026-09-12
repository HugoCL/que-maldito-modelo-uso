/**
 * Todas las cadenas visibles, en un solo sitio.
 *
 * La app es en español porque el nombre lo pide, pero nada en los componentes
 * tiene texto incrustado: añadir inglés es escribir un archivo hermano de este
 * y elegir cuál importar.
 */
export const es = {
  marca: {
    // El "maldito" va censurado en pantalla; el nombre completo vive en la URL.
    nombre: "Qué m*ldito modelo uso",
    nombreCorto: "qmmu",
    lema: "Tres respuestas, actualizadas solas. Sin tablas de cuarenta filas.",
  },
  nav: {
    inicio: "Inicio",
    metodologia: "Metodología",
    creditos: "Créditos",
    estado: "Estado",
  },
  tiers: {
    barato: {
      titulo: "Barato",
      subtitulo: "Mantenimiento y bajo riesgo",
      descripcion: "Renombrar, tests, boilerplate, arreglos pequeños.",
    },
    dia_a_dia: {
      titulo: "Día a día",
      subtitulo: "El que dejas puesto",
      descripcion: "La mejor relación entre lo que rinde y lo que cuesta.",
    },
    bueno: {
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
  },
} as const;

export type Textos = typeof es;
