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
    lema: "¿Cansado de preguntar o buscar cuál es el mejor modelo? Tres respuestas.",
  },
  nav: {
    inicio: "Inicio",
    metodologia: "Metodología",
    creditos: "Créditos",
    estado: "Estado",
  },
  tema: {
    sistema: "el del sistema",
    claro: "claro",
    oscuro: "oscuro",
    cambiar: (siguiente: string) => `Cambiar al tema ${siguiente}`,
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
    // La marca que llevan las respuestas que solo existen porque alguien bajó
    // el mínimo de benchmarks. Va en minúscula y pegada al nombre: quien la ve
    // está mirando el nombre, no buscando una leyenda.
    confianzaBaja: "confianza baja",
    confianzaBajaNota:
      "Un solo benchmark ha medido esta variante: su nota es esa única medición, sin promedio que la contraste.",
    // La marca de una tarjeta que recomienda el mismo modelo que otra. Dice a
    // cuál repite, porque «también es el barato» y «también es el mejor» no
    // significan lo mismo ni de lejos.
    repite: {
      barato: "también es el barato",
      dia_a_dia: "también es el del día a día",
      bueno: "también es el mejor",
    },
    repiteNota:
      "El codo de la curva cae exactamente en este modelo, así que responde a las dos preguntas. No es un fallo: es que hoy no hay un escalón intermedio que compense.",
    medidoPor: "Medido por",
    disponibleEn: "Disponible en",
    pesosAbiertos: "Open Weight",
  },
  // El desglose de la nota, en la ficha del modelo. No es decoración: una nota
  // de 0 a 100 que nadie puede rehacer a mano es un número pedido de fe, y
  // este sitio entero va de no pedir fe.
  desglose: {
    titulo: "De dónde sale cada nota",
    media: "media nivelada",
    // Cabeceras del desglose. Son cuatro columnas porque la nota tiene cuatro
    // pasos y esconder uno la volvería a hacer imposible de comprobar.
    publica: "publica",
    enLaEscala: "escala",
    desnivel: "desnivel",
    nivelado: "nivelado",
    // Los extremos son del conjunto entero, así que son los mismos para todas
    // las filas de todos los modelos. Van una vez al final y no repetidos en
    // cada una, que es lo que hacía que esto no cupiera para cada effort.
    escala: (etiqueta: string, min: string, max: string) => `${etiqueta}, de ${min} a ${max}`,
    escalas: (lista: string) => `Las escalas salen de los extremos medidos del conjunto: ${lista}.`,
    comoSeLee:
      "Cada benchmark se reescala para que el peor resultado del conjunto sea 0 y el mejor 100. Después se le resta su desnivel, que es cuánto puntúa de más o de menos que los otros sobre los modelos que comparten: sin eso, un 70 de un benchmark y un 70 de otro no valen lo mismo y la nota acabaría diciendo quién te midió en vez de cómo rendiste. Lo que queda es lo que se promedia.",
    // La media ya no es la nota, y decirlo aquí no es un detalle: es la
    // diferencia entre una cifra que se puede comprobar y una que hay que
    // creerse. Los dos últimos pasos son iguales para todo el mundo.
    ultimosPasos:
      "La nota de arriba no es esa media: antes se acerca al centro del conjunto según cuántas mediciones la sostienen, porque una media de dos se mueve más que una de tres, y después el conjunto entero se estira otra vez a 0-100.",
    // "Salvo que se baje el mínimo" y no "no puede ser respuesta" a secas: la
    // portada deja bajarlo, y esta ficha no sabe si se ha bajado. Una frase que
    // se contradiga con la fila de la que se viene valdría menos que ninguna.
    unSoloBenchmark:
      "Con un solo benchmark no hay promedio que hacer: la nota es esa única medición, y es la que más se acerca al centro por eso mismo. Por eso una variante así no compite por las tres respuestas, salvo que se baje el mínimo a mano en la página principal.",
  },
  // El $ por tarea no es un presupuesto. Sale de lo que costó resolver las
  // tareas de los benchmarks, puestas todas en la misma escala, y esa frase
  // tiene que estar donde está el número y no solo en /metodologia.
  indice: {
    corto: "índice de eficiencia",
    ayuda:
      "Lo que costó resolver las tareas de los benchmarks, con las tres fuentes puestas en la misma escala. Sirve para comparar modelos entre sí; no es lo que vas a pagar tú, que depende de tu repo, de tu prompt y de tu harness.",
    enElGlobo: "escala común entre benchmarks",
  },
  filtros: {
    titulo: "¿Para qué lo quieres?",
    presupuesto: "Máximo por tarea",
    // Cada grupo es una pregunta, no un verbo suelto: "exige" y "puntúa con"
    // se leían como una sola frase y no se entendía qué hacía cada pastilla.
    maxPorTarea: "tope por tarea",
    hasta: (valor: string) => `hasta $${valor}`,
    sinTechoCorto: "sin tope",
    // El interruptor de una fuente con sesgo de cobertura. El nombre del
    // benchmark es la etiqueta del grupo; lo que se elige es si cuenta o no.
    // En positivo: encendida es el estado normal.
    cuenta: "cuenta",
    noCuenta: "no cuenta",
    apagada: (etiqueta: string) => `${etiqueta} no cuenta`,
    // El mínimo de benchmarks para poder ser respuesta. "Al menos N" y no
    // "N benchmarks": eso último se lee como cuántos se usan para puntuar,
    // y aquí se elige el umbral para poder ganar una tarjeta. La cifra sale
    // del umbral: si mañana la metodología pide tres, la barra lo dice sola.
    minimo: "para ser respuesta",
    minimoPastilla: (n: number) =>
      n === 1 ? "al menos 1 benchmark" : `al menos ${n} benchmarks`,
    minimoUnoAyuda:
      "Casi todo lo open weight lo ha medido un solo benchmark. Bajar el mínimo a uno los deja competir, con el precio de que su nota sale de una única medición, la del benchmark que les tocó: entran marcados como confianza baja.",
    // Debajo de la barra, en una línea: con qué se puntúa y hasta dónde se
    // gasta. Los nombres de los benchmarks salen de la configuración, así que
    // encender o apagar una fuente cambia esta frase sola.
    puntuaCon: (benchmarks: string) => `Puntúa con ${benchmarks}`,
    conTope: (tope: string) => `nada por encima de $${tope} la tarea`,
    conUnBenchmark: "basta un benchmark para poder ser respuesta",
    sinTecho: "sin techo",
    soloOpenWeight: "Solo Open Weight",
    atajos: "atajos",
    noPuedoUsar: "filtrar modelos",
    noPuedoUsarAyuda:
      "Desmarca los que no puedes usar, o los que no quieres, para sacarlos de las tres respuestas y del gráfico.",
    aplicarOcultos: "aplicar",
    todosDelGrupo: "todos",
    copiarEnlace: "copiar enlace",
    enlaceCopiado: "copiado",
    ocultosN: (n: number) => (n === 1 ? "1 oculto" : `${n} ocultos`),
    mostrarTodos: "mostrar todos",
    soloGpt: "Solo GPT",
    soloClaude: "Solo Claude",
    soloGemini: "Solo Gemini",
    soloGrok: "Solo Grok",
    openWeight: "open weight",
    openWeightNinguno: "ninguno open weight",
    openWeightUno: "1 open weight",
    openWeightN: (n: number) => `${n} open weight`,
    proveedor: "Proveedor",
    cualquiera: "Cualquiera",
    limpiar: "Quitar filtros",
    recalculando: "Recalculando…",
  },
  estado: {
    actualizado: "Actualizado",
    nunca: "todavía sin runs",
    modoSemilla: "Datos de ejemplo",
    modoSemillaDetalle:
      "Sin despliegue de Convex conectado: lo que ves es una instantánea del pipeline del",
    fuentes: "Fuentes",
    // No es un fallo del run: un benchmark nombró algo que no está en el
    // catálogo (o no se parece lo bastante) y esa medición no puntúa.
    sinResolver:
      "Hay nombres que un benchmark publicó y que no pudimos emparejar con ningún modelo del catálogo: no entran en el ranking.",
    sinResolverMas: (n: number) => (n === 1 ? "y 1 más" : `y ${n} más`),
    corridas: "Últimos runs",
    listo: "listo",
    enCurso: "en curso…",
    enCola: "en cola",
    fallo: "falló",
    apagada: "apagada",
    sinCorridas: "sin runs todavía",
  },
  portada: {
    calidad: "calidad",
    porTarea: "/tarea",
    deCien: "/100",
    // La línea de arriba del titular. Dice de dónde salen los números y de
    // cuándo son, que es lo único que hace falta saber antes de leerlos. En
    // trozos porque en estrecho no caben los tres y hay que poder quitar uno.
    benchmarks: (n: number) => (n === 1 ? "1 benchmark" : `${n} benchmarks`),
    variantes: (n: number) => (n === 1 ? "1 variante puntuada" : `${n} variantes puntuadas`),
    pieDeTabla: (benchmarks: number) =>
      `calidad de ${benchmarks} benchmarks nivelados · el $/tarea es un índice, no tu factura`,
    ejes: (elegibles: number, enFrontera: number) =>
      `calidad × costo · ${elegibles} variantes · ${enFrontera} en el frontier`,
    ejesCorto: (elegibles: number) => `calidad × costo · ${elegibles} variantes`,
    unaFuente: (n: number) =>
      n === 1
        ? "Otra variante está medida por un solo benchmark y no compite por las tres respuestas"
        : `Otras ${n} variantes están medidas por un solo benchmark y no compiten por las tres respuestas`,
    unaFuenteEnlace: "cuáles y por qué",
    alternativas: (n: number) => (n === 1 ? "1 alternativa" : `${n} alternativas`),
    sinAcceso: "Otras respuestas a esta misma pregunta, por si no puedes usar la recomendada",
    faltanRespuestas:
      "Con estos benchmarks no hay datos para las tres respuestas: solo salen las que se pueden defender.",
    // Por qué falta la del día a día. Tres frases y no una: antes las tres
    // situaciones se contaban como «no hay datos», y en dos de ellas había
    // datos de sobra y lo que pasaba era otra cosa.
    sinDiaADia: {
      fronteraCorta: (puntos: number) =>
        puntos === 1
          ? "Con estos filtros solo queda un intercambio posible, y para tres respuestas hacen falta tres."
          : `Con estos filtros solo quedan ${puntos} intercambios distintos, y para tres respuestas hacen falta tres.`,
      sinCodo:
        "Aquí no hay término medio que valga la pena: todo lo intermedio rinde peor que quedarse con el barato o irse al mejor.",
      bajoElPiso: (mejor: string, piso: string) =>
        `Lo que hay en medio se queda en ${mejor} de calidad y hacen falta ${piso} para poder recomendarlo. Está en el gráfico, pero no como respuesta.`,
    },
    // Cuando faltan respuestas con el mínimo en uno el motivo es el contrario:
    // sobran candidatos baratos con una sola medición, y entre el más barato y
    // el mejor ya no queda tramo intermedio que recomendar. Decirlo importa,
    // porque es la consecuencia de haber tocado el interruptor.
    faltanRespuestasConUno:
      "Con un solo benchmark exigido, los medidos una vez entran baratos y con la nota de ese único benchmark, y aplastan el tramo intermedio. No es que falten datos: es lo que pasa al aflojar la regla.",
    sinDatosDeCosto: "sin costo medido",
  },
  vacio: {
    titulo: "Ningún modelo pasa esos filtros",
    descripcion:
      "Con esas restricciones no queda nada medido por suficientes benchmarks. Prueba a subir el techo de costo o a quitar el atajo.",
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
