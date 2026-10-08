document
  .getElementById("botonOrdenarTexto")
  .addEventListener("click", function () {
    let texto = document.getElementById("area-texto").value;

    texto = reubicarAsterisco(texto);

    texto = texto.replace(/\r\n|\r|\n/g, "\n").trim();

    texto = texto.replace(/^\s+/gm, "");

    const lineas = texto.split("\n");
    let textoLimpio = "";

    lineas.forEach((linea) => {
      let lineaLimpiada = linea.trim();

      const regexPregunta =
        /^(?:pregunta\s*)?(\d+)([\.\-\:]{0,2})(?![\d\/\.])\s*(.*)/i;
      const matchPregunta = lineaLimpiada.match(regexPregunta);

      if (matchPregunta) {
        let numeroPregunta = matchPregunta[1];
        let contenidoPregunta = matchPregunta[3].trim();

        lineaLimpiada = numeroPregunta + ". " + contenidoPregunta;
        textoLimpio += lineaLimpiada + "\n";
      } else {
        const regexAlternativa =
          /^\s*(\*?)([A-Ha-h])(?![A-Za-z])[\)\.\-–]?\s+(.*)/;
        const matchAlternativa = linea.match(regexAlternativa);

        if (matchAlternativa) {
          let asterisco = matchAlternativa[1];
          let identificador = matchAlternativa[2].toLowerCase();
          let contenido = matchAlternativa[3].trim();
          lineaLimpiada = asterisco + identificador + ") " + contenido;
          textoLimpio += lineaLimpiada + "\n";
        } else {
          textoLimpio += linea.trim() + "\n";
        }
      }
    });

    textoLimpio = textoLimpio
      .split("\n")
      .map((linea) => linea.replace(/\s+/g, " "))
      .join("\n");

    textoLimpio = textoLimpio.replace(/\n\s*\n/g, "\n").trimEnd();

    textoLimpio = textoLimpio.replace(/^(i{1,3}|iv|v)\./gm, function (match) {
      return match.toUpperCase();
    });

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
          /Réponse correcte:/gi,
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
    ];

    frasesReemplazo.forEach((item) => {
      item.patrones.forEach((patron) => {
        textoLimpio = textoLimpio.replace(patron, item.reemplazo);
      });
    });

    const lineasFinales = textoLimpio.split("\n");
    let resultadoFinal = "";
    let contadorPreguntas = 0;

    lineasFinales.forEach((linea) => {
      const regexPreguntaFinal = /^(\d+)\.\s+(.*)/;
      const matchPreguntaFinal = linea.match(regexPreguntaFinal);

      if (matchPreguntaFinal) {
        contadorPreguntas++;
        if (contadorPreguntas > 1) {
          resultadoFinal += "\n";
        }
        resultadoFinal += linea + "\n";
      } else {
        resultadoFinal += linea + "\n";
      }
    });

    resultadoFinal = resultadoFinal.trimEnd();

    const lineasFeedback = resultadoFinal.split("\n");
    let resultadoConEspacio = "";

    for (let i = 0; i < lineasFeedback.length; i++) {
      let lineaActual = lineasFeedback[i];

      if (
        lineaActual.startsWith("Feedback Alternativa Correcta:") ||
        lineaActual.startsWith("Feedback Alternativa Incorrecta:")
      ) {
        if (i > 0 && lineasFeedback[i - 1].trim() !== "") {
          resultadoConEspacio += "\n";
        }
      }

      resultadoConEspacio += lineaActual + "\n";
    }

    resultadoConEspacio = resultadoConEspacio.trimEnd();

    const lineasProcesadas = resultadoConEspacio.split("\n");
    let resultadoConAlternativasCorregidas = "";
    let bloquesPreguntas = [];
    let bloqueActual = [];

    lineasProcesadas.forEach((linea) => {
      const regexPregunta = /^(\d+)\.\s+(.*)/;
      const matchPregunta = linea.match(regexPregunta);

      if (matchPregunta) {
        if (bloqueActual.length > 0) {
          bloquesPreguntas.push(bloqueActual);
          bloqueActual = [];
        }
      }

      bloqueActual.push(linea);
    });

    if (bloqueActual.length > 0) {
      bloquesPreguntas.push(bloqueActual);
    }

    function numeroARomano(num) {
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
      ];
      let resultado = "";
      for (let i = 0; i < romanos.length; i++) {
        while (num >= romanos[i].value) {
          resultado += romanos[i].numeral;
          num -= romanos[i].value;
        }
      }
      return resultado;
    }

    bloquesPreguntas.forEach((bloque) => {
      const regexPregunta = /^(\d+)\.\s+(.*)/;
      const matchPregunta = bloque[0].match(regexPregunta);

      if (matchPregunta) {
        let numeroPregunta = matchPregunta[1];
        let contenidoPregunta = matchPregunta[2].trim();

        let bloqueProcesado = [];
        bloqueProcesado.push(numeroPregunta + ". " + contenidoPregunta);

        let alternativas = [];
        for (let i = 1; i < bloque.length; i++) {
          const regexAlternativa = /^\s*([a-hA-H])\)\s+(.*)/;
          const matchAlternativa = bloque[i].match(regexAlternativa);

          if (matchAlternativa) {
            let identificador = matchAlternativa[1].toLowerCase();
            let contenido = matchAlternativa[2].trim();
            alternativas.push({ identificador, contenido, linea: bloque[i] });
          }
        }

        let aCount = alternativas.filter(
          (alt) => alt.identificador === "a"
        ).length;

        if (aCount >= 2) {
          let contadorRomano = 1;
          let aEncontrado = 0;
          const letrasAModificar = ["a", "b", "c", "d", "e", "f", "g", "h"];
          for (let i = 0; i < alternativas.length; i++) {
            let alt = alternativas[i];
            if (alt.identificador === "a") {
              aEncontrado++;
              if (aEncontrado === 2) {
                bloqueProcesado.push(alt.identificador + ") " + alt.contenido);
                continue;
              }
            }

            if (
              aEncontrado < 2 &&
              letrasAModificar.includes(alt.identificador)
            ) {
              let romano = numeroARomano(contadorRomano) + ".";
              bloqueProcesado.push(romano + " " + alt.contenido);
              contadorRomano++;
            } else {
              bloqueProcesado.push(alt.identificador + ") " + alt.contenido);
            }
          }
        } else {
          bloqueProcesado = bloque;
        }

        resultadoConAlternativasCorregidas += bloqueProcesado.join("\n") + "\n";
      } else {
        resultadoConAlternativasCorregidas += bloque.join("\n") + "\n";
      }
    });

    resultadoConAlternativasCorregidas =
      resultadoConAlternativasCorregidas.trimEnd();

    const regexElementosValidos =
      /^(\s*\d+\.\s|\s*[a-hA-H]\)\s|\s*[IVXLCDM]+\.\s|Feedback Alternativa Correcta:|Feedback Alternativa Incorrecta:).*/;
    let resultadoFiltrado = "";
    let textosEliminados = [];
    let contadorEliminados = 1;

    resultadoConAlternativasCorregidas.split("\n").forEach((linea) => {
      if (regexElementosValidos.test(linea) || linea.trim() === "") {
        resultadoFiltrado += linea + "\n";
      } else {
        textosEliminados.push(`${contadorEliminados}- ${linea.trim()}`);
        contadorEliminados++;
      }
    });

    if (textosEliminados.length > 0) {
      mostrarModal(textosEliminados.join("\n"));
    }

    document.getElementById("area-texto").value = resultadoFiltrado.trimEnd();
  });

function mostrarModal(contenido) {
  const modal = document.getElementById("modalAlerta");
  const modalTexto = document.getElementById("modalTexto");
  modalTexto.innerText = contenido;
  modal.style.display = "flex";
}

document.getElementById("modalCerrar").addEventListener("click", function () {
  const modal = document.getElementById("modalAlerta");
  modal.style.display = "none";
});

function reubicarAsterisco(texto) {
  const lineas = texto.split("\n");
  return lineas
    .map((linea) => {
      let regex = /^\s*\*([A-Ha-h])(?![A-Za-z])([\)\.\-–]?)\s+(.*)/;
      let match = linea.match(regex);
      if (match) {
        const alternativa = match[1].toLowerCase();
        const puntuacion = match[2] || ")";
        const contenido = match[3];
        return `${alternativa}${puntuacion} *${contenido}`;
      }

      regex = /^\s*([A-Ha-h])\*(?![A-Za-z])([\)\.\-–]?)\s+(.*)/;
      match = linea.match(regex);
      if (match) {
        const alternativa = match[1].toLowerCase();
        const puntuacion = match[2] || ")";
        const contenido = match[3];
        return `${alternativa}${puntuacion} *${contenido}`;
      }

      return linea.trim();
    })
    .join("\n");
}
