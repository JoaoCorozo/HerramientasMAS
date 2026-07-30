import JSZip from "jszip"

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function reubicarAsterisco(texto: string): string {
  return texto
    .split("\n")
    .map((linea) => {
      let regex = /^\s*\*([A-Ha-h])(?![A-Za-z])([\)\.\-–]?)\s+(.*)/
      let match = linea.match(regex)
      if (match) {
        const alternativa = match[1].toLowerCase()
        const puntuacion = match[2] || ")"
        const contenido = match[3]
        return `${alternativa}${puntuacion} *${contenido}`
      }

      regex = /^\s*([A-Ha-h])\*(?![A-Za-z])([\)\.\-–]?)\s+(.*)/
      match = linea.match(regex)
      if (match) {
        const alternativa = match[1].toLowerCase()
        const puntuacion = match[2] || ")"
        const contenido = match[3]
        return `${alternativa}${puntuacion} *${contenido}`
      }

      return linea.trim()
    })
    .join("\n")
}

function numeroARomano(num: number): string {
  const romanos = [
    { value: 1000, numeral: "M" },
    { value: 900, numeral: "CM" },
    { value: 500, numeral: "D" },
    { value: 400, numeral: "CD" },
    { value: 100, numeral: "C" },
    { value: 90, numeral: "XC" },
    { value: 50, numeral: "L" },
    { value: 40, numeral: "XL" },
    { value: 10, numeral: "X" },
    { value: 9, numeral: "IX" },
    { value: 5, numeral: "V" },
    { value: 4, numeral: "IV" },
    { value: 1, numeral: "I" },
  ]
  let n = num
  let resultado = ""
  for (const item of romanos) {
    while (n >= item.value) {
      resultado += item.numeral
      n -= item.value
    }
  }
  return resultado
}

export function ordenarTextoEvaluacion(textoOriginal: string): {
  texto: string
  textosEliminados: string[]
} {
  let texto = reubicarAsterisco(textoOriginal)
  texto = texto.replace(/\r\n|\r|\n/g, "\n").trim()
  texto = texto.replace(/^\s+/gm, "")

  const lineas = texto.split("\n")
  let textoLimpio = ""

  lineas.forEach((linea) => {
    let lineaLimpiada = linea.trim()
    const regexPregunta = /^(?:pregunta\s*)?(\d+)([\.\-\:]{0,2})(?![\d\/\.])\s*(.*)/i
    const matchPregunta = lineaLimpiada.match(regexPregunta)

    if (matchPregunta) {
      const numeroPregunta = matchPregunta[1]
      const contenidoPregunta = matchPregunta[3].trim()
      lineaLimpiada = `${numeroPregunta}. ${contenidoPregunta}`
      textoLimpio += `${lineaLimpiada}\n`
    } else {
      const regexAlternativa = /^\s*(\*?)([A-Ha-h])(?![A-Za-z])[\)\.\-–]?\s+(.*)/
      const matchAlternativa = linea.match(regexAlternativa)
      if (matchAlternativa) {
        const asterisco = matchAlternativa[1]
        const identificador = matchAlternativa[2].toLowerCase()
        const contenido = matchAlternativa[3].trim()
        lineaLimpiada = `${asterisco}${identificador}) ${contenido}`
        textoLimpio += `${lineaLimpiada}\n`
      } else {
        textoLimpio += `${linea.trim()}\n`
      }
    }
  })

  textoLimpio = textoLimpio
    .split("\n")
    .map((linea) => linea.replace(/\s+/g, " "))
    .join("\n")
  textoLimpio = textoLimpio.replace(/\n\s*\n/g, "\n").trimEnd()
  textoLimpio = textoLimpio.replace(/^(i{1,3}|iv|v)\./gm, (match) => match.toUpperCase())

  const frasesReemplazo = [
    {
      patrones: [
        /Feedback Alternativa Correcta:/gi,
        /Retroalimentación correcta:/gi,
        /Feedback correcto:/gi,
        /Feedback positivo:/gi,
        /FC:/gi,
        /Respuesta correcta:/gi,
        /Retroalimentación positiva:/gi,
        /Comentario positivo:/gi,
        /Confirmación correcta:/gi,
        /Evaluación positiva:/gi,
        /Réponse correcte:/gi,
        /Feedback for correct answer:/gi,
        /Correct feedback:/gi,
        /Resposta correta:/gi,
        /正确答案：/gi,
        /正确答案:/gi,
        /Correct Answer:/gi,
        /Réponse correcte :/gi,
        /Bonne réponse :/gi,
        /Bonne réponse:/gi,
        /ข้อเสนอแนะสำหรับคำตอบที่ถูกต้อง:/gi,
      ],
      reemplazo: "Feedback Alternativa Correcta:",
    },
    {
      patrones: [
        /Retroalimentación incorrecta:/gi,
        /Feedback incorrecto:/gi,
        /Feedback negativo:/gi,
        /FI:/gi,
        /Respuesta incorrecta:/gi,
        /Retroalimentación negativa:/gi,
        /Comentario negativo:/gi,
        /Evaluación incorrecta:/gi,
        /Confirmación incorrecta:/gi,
        /Réponse incorrecte :/gi,
        /Feedback for incorrect answer:/gi,
        /Feedback for inFeedback Alternativa Correcta:/gi,
        /InFeedback Alternativa Correcta:/gi,
        /Incorrect feedback:/gi,
        /Resposta errada:/gi,
        /Resposta incorreta:/gi,
        /错误答案：/gi,
        /错误答案:/gi,
        /Incorrect answer:/gi,
        /Mauvaise réponse :/gi,
        /Mauvaise réponse:/gi,
        /ข้อเสนอแนะสำหรับคำตอบที่ไม่ถูกต้อง:/gi,
        /Feedback Alternativa Incorrecta:/gi,
      ],
      reemplazo: "Feedback Alternativa Incorrecta:",
    },
  ]

  frasesReemplazo.forEach((item) => {
    item.patrones.forEach((patron) => {
      textoLimpio = textoLimpio.replace(patron, item.reemplazo)
    })
  })

  const lineasFinales = textoLimpio.split("\n")
  let resultadoFinal = ""
  let contadorPreguntas = 0
  lineasFinales.forEach((linea) => {
    const matchPreguntaFinal = linea.match(/^(\d+)\.\s+(.*)/)
    if (matchPreguntaFinal) {
      contadorPreguntas++
      if (contadorPreguntas > 1) resultadoFinal += "\n"
      resultadoFinal += `${linea}\n`
    } else {
      resultadoFinal += `${linea}\n`
    }
  })
  resultadoFinal = resultadoFinal.trimEnd()

  const lineasFeedback = resultadoFinal.split("\n")
  let resultadoConEspacio = ""
  for (let i = 0; i < lineasFeedback.length; i++) {
    const lineaActual = lineasFeedback[i]
    if (
      lineaActual.startsWith("Feedback Alternativa Correcta:") ||
      lineaActual.startsWith("Feedback Alternativa Incorrecta:")
    ) {
      if (i > 0 && lineasFeedback[i - 1].trim() !== "") {
        resultadoConEspacio += "\n"
      }
    }
    resultadoConEspacio += `${lineaActual}\n`
  }
  resultadoConEspacio = resultadoConEspacio.trimEnd()

  const lineasProcesadas = resultadoConEspacio.split("\n")
  const bloquesPreguntas: string[][] = []
  let bloqueActual: string[] = []
  lineasProcesadas.forEach((linea) => {
    if (/^(\d+)\.\s+(.*)/.test(linea)) {
      if (bloqueActual.length > 0) {
        bloquesPreguntas.push(bloqueActual)
        bloqueActual = []
      }
    }
    bloqueActual.push(linea)
  })
  if (bloqueActual.length > 0) bloquesPreguntas.push(bloqueActual)

  let resultadoConAlternativasCorregidas = ""
  bloquesPreguntas.forEach((bloque) => {
    const matchPregunta = bloque[0].match(/^(\d+)\.\s+(.*)/)
    if (matchPregunta) {
      const numeroPregunta = matchPregunta[1]
      const contenidoPregunta = matchPregunta[2].trim()
      let bloqueProcesado = [`${numeroPregunta}. ${contenidoPregunta}`]
      const alternativas: { identificador: string; contenido: string; linea: string }[] = []
      for (let i = 1; i < bloque.length; i++) {
        const matchAlternativa = bloque[i].match(/^\s*([a-hA-H])\)\s+(.*)/)
        if (matchAlternativa) {
          alternativas.push({
            identificador: matchAlternativa[1].toLowerCase(),
            contenido: matchAlternativa[2].trim(),
            linea: bloque[i],
          })
        }
      }
      const aCount = alternativas.filter((alt) => alt.identificador === "a").length
      if (aCount >= 2) {
        let contadorRomano = 1
        let aEncontrado = 0
        const letrasAModificar = ["a", "b", "c", "d", "e", "f", "g", "h"]
        for (const alt of alternativas) {
          if (alt.identificador === "a") {
            aEncontrado++
            if (aEncontrado === 2) {
              bloqueProcesado.push(`${alt.identificador}) ${alt.contenido}`)
              continue
            }
          }
          if (aEncontrado < 2 && letrasAModificar.includes(alt.identificador)) {
            bloqueProcesado.push(`${numeroARomano(contadorRomano)}. ${alt.contenido}`)
            contadorRomano++
          } else {
            bloqueProcesado.push(`${alt.identificador}) ${alt.contenido}`)
          }
        }
      } else {
        bloqueProcesado = bloque
      }
      resultadoConAlternativasCorregidas += `${bloqueProcesado.join("\n")}\n`
    } else {
      resultadoConAlternativasCorregidas += `${bloque.join("\n")}\n`
    }
  })
  resultadoConAlternativasCorregidas = resultadoConAlternativasCorregidas.trimEnd()

  const regexElementosValidos =
    /^(\s*\d+\.\s|\s*[a-hA-H]\)\s|\s*[IVXLCDM]+\.\s|Feedback Alternativa Correcta:|Feedback Alternativa Incorrecta:).*/
  let resultadoFiltrado = ""
  const textosEliminados: string[] = []
  let contadorEliminados = 1
  resultadoConAlternativasCorregidas.split("\n").forEach((linea) => {
    if (regexElementosValidos.test(linea) || linea.trim() === "") {
      resultadoFiltrado += `${linea}\n`
    } else {
      textosEliminados.push(`${contadorEliminados}- ${linea.trim()}`)
      contadorEliminados++
    }
  })

  return {
    texto: resultadoFiltrado.trimEnd(),
    textosEliminados,
  }
}

export function convertirOpcionMultiple(
  texto: string,
  agregarNegritaAlEnunciado: boolean
): string {
  const lineas = texto.split("\n")
  let textoConvertido = ""
  let enPregunta = false
  let numeroPregunta = 0
  let retroalimentacionCorrecta = ""
  let retroalimentacionIncorrecta = ""
  let enunciadoPregunta: string[] = []
  let opcionesRespuesta: { texto: string; esCorrecta: boolean }[] = []

  const flushPregunta = () => {
    numeroPregunta++
    const textoEnunciado = enunciadoPregunta.join("\n").trim()
    if (!textoEnunciado) return
    if (agregarNegritaAlEnunciado) {
      textoConvertido += `::Pregunta ${numeroPregunta.toString().padStart(2, "0")}::<strong>${textoEnunciado}</strong> {\n`
    } else {
      textoConvertido += `::Pregunta ${numeroPregunta.toString().padStart(2, "0")}::${textoEnunciado} {\n`
    }
    opcionesRespuesta.forEach((opcion) => {
      const textoOpcion = opcion.texto.trim()
      if (opcion.esCorrecta) {
        textoConvertido += `=${textoOpcion}`
        if (retroalimentacionCorrecta) textoConvertido += `#${retroalimentacionCorrecta}`
        textoConvertido += "\n"
      } else {
        textoConvertido += `~${textoOpcion}`
        if (retroalimentacionIncorrecta) textoConvertido += `#${retroalimentacionIncorrecta}`
        textoConvertido += "\n"
      }
    })
    textoConvertido += "}\n\n"
  }

  lineas.forEach((lineaRaw) => {
    let linea = lineaRaw
    const lineaLimpiada = linea.trim()

    if (/^\d+[.\-\s)]/.test(lineaLimpiada)) {
      if (enPregunta) {
        flushPregunta()
        enunciadoPregunta = []
        retroalimentacionCorrecta = ""
        retroalimentacionIncorrecta = ""
        opcionesRespuesta = []
      }
      linea = linea.replace(/^\d+[.\-\s)]+/, "")
      enunciadoPregunta.push(linea)
      enPregunta = true
    } else if (/^[a-z]\)[\s]*\S/.test(lineaLimpiada)) {
      linea = linea.replace(/^\w\)\s*/, "")
      const esCorrecta = linea.includes("*")
      if (esCorrecta) linea = linea.replace(/\*/, "")
      opcionesRespuesta.push({ texto: linea.trim(), esCorrecta })
    } else if (/^feedback\s+alternativa\s+correcta:/i.test(lineaLimpiada)) {
      retroalimentacionCorrecta = lineaLimpiada
        .replace(/^feedback\s+alternativa\s+correcta:/i, "")
        .trim()
    } else if (/^feedback\s+alternativa\s+incorrecta:/i.test(lineaLimpiada)) {
      retroalimentacionIncorrecta = lineaLimpiada
        .replace(/^feedback\s+alternativa\s+incorrecta:/i, "")
        .trim()
    } else if (enPregunta) {
      enunciadoPregunta.push(linea)
    }
  })

  if (enPregunta) flushPregunta()
  return textoConvertido
}

export async function marcarAlternativaCorrectaDocx(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)
  const docFile = zip.file("word/document.xml")
  if (!docFile) throw new Error("El archivo no parece un .docx válido (falta word/document.xml).")

  const docXml = await docFile.async("string")
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(docXml, "application/xml")

  const coloresResaltado: Record<string, number> = {}
  const coloresSombreado: Record<string, number> = {}
  const ejecuciones = Array.from(xmlDoc.getElementsByTagName("w:r"))

  for (const ejecucion of ejecuciones) {
    const resaltado = ejecucion.getElementsByTagName("w:highlight")[0]
    if (resaltado) {
      const colorResaltado = resaltado.getAttribute("w:val")
      if (colorResaltado) {
        coloresResaltado[colorResaltado] = (coloresResaltado[colorResaltado] || 0) + 1
      }
    }
    const sombreado = ejecucion.getElementsByTagName("w:shd")[0]
    if (sombreado) {
      const colorSombreado = sombreado.getAttribute("w:fill")
      if (colorSombreado && colorSombreado !== "auto") {
        coloresSombreado[colorSombreado] = (coloresSombreado[colorSombreado] || 0) + 1
      }
    }
  }

  let colorDominanteResaltado = ""
  let maximoConteoResaltado = 0
  for (const color in coloresResaltado) {
    if (coloresResaltado[color] > maximoConteoResaltado) {
      maximoConteoResaltado = coloresResaltado[color]
      colorDominanteResaltado = color
    }
  }

  let colorDominanteSombreado = ""
  let maximoConteoSombreado = 0
  for (const color in coloresSombreado) {
    if (coloresSombreado[color] > maximoConteoSombreado) {
      maximoConteoSombreado = coloresSombreado[color]
      colorDominanteSombreado = color
    }
  }

  const colorDominante =
    maximoConteoResaltado >= maximoConteoSombreado
      ? colorDominanteResaltado
      : colorDominanteSombreado

  let esPrimeraEjecucionResaltada = true
  for (const ejecucion of ejecuciones) {
    const resaltado = ejecucion.getElementsByTagName("w:highlight")[0]
    const sombreado = ejecucion.getElementsByTagName("w:shd")[0]
    const elementoTexto = ejecucion.getElementsByTagName("w:t")[0]
    let colorDetectado: string | null = null
    if (resaltado) colorDetectado = resaltado.getAttribute("w:val")
    else if (sombreado) colorDetectado = sombreado.getAttribute("w:fill")

    if (elementoTexto && colorDetectado === colorDominante) {
      if (esPrimeraEjecucionResaltada) {
        elementoTexto.textContent = `*${elementoTexto.textContent || ""}`
        esPrimeraEjecucionResaltada = false
      }
    } else {
      esPrimeraEjecucionResaltada = true
    }
  }

  const serializador = new XMLSerializer()
  zip.file("word/document.xml", serializador.serializeToString(xmlDoc))
  return zip.generateAsync({ type: "blob" })
}
