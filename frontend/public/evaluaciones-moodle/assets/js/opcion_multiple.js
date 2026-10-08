document
  .getElementById("botonConvertir")
  .addEventListener("click", function () {
    procesarPreguntasOpcionMultiple(false);
  });

document.getElementById("botonNegrita").addEventListener("click", function () {
  procesarPreguntasOpcionMultiple(true);
});

function procesarPreguntasOpcionMultiple(agregarNegritaAlEnunciado) {
  const texto = document.getElementById("area-texto").value;
  const lineas = texto.split("\n");
  let textoConvertido = "";
  let enPregunta = false;
  let numeroPregunta = 0;
  let respuestasCorrectas = [];
  let respuestasIncorrectas = [];
  let retroalimentacionCorrecta = "";
  let retroalimentacionIncorrecta = "";
  let enunciadoPregunta = [];
  let opcionesRespuesta = [];

  lineas.forEach(function (linea) {
    const lineaLimpiada = linea.trim();

    if (/^\d+[.\-\s)]/.test(lineaLimpiada)) {
      if (enPregunta) {
        numeroPregunta++;
        const textoEnunciado = enunciadoPregunta.join("\n").trim();
        if (textoEnunciado) {
          if (agregarNegritaAlEnunciado) {
            textoConvertido += `::Pregunta ${numeroPregunta
              .toString()
              .padStart(2, "0")}::<strong>${textoEnunciado}</strong> {\n`;
          } else {
            textoConvertido += `::Pregunta ${numeroPregunta
              .toString()
              .padStart(2, "0")}::${textoEnunciado} {\n`;
          }

          opcionesRespuesta.forEach((opcion) => {
            const textoOpcion = opcion.texto.trim();
            if (opcion.esCorrecta) {
              textoConvertido += `=${textoOpcion}`;
              if (retroalimentacionCorrecta) {
                textoConvertido += `#${retroalimentacionCorrecta}`;
              }
              textoConvertido += "\n";
            } else {
              textoConvertido += `~${textoOpcion}`;
              if (retroalimentacionIncorrecta) {
                textoConvertido += `#${retroalimentacionIncorrecta}`;
              }
              textoConvertido += "\n";
            }
          });

          textoConvertido += "}\n\n";
        }
        enunciadoPregunta = [];
        respuestasCorrectas = [];
        respuestasIncorrectas = [];
        retroalimentacionCorrecta = "";
        retroalimentacionIncorrecta = "";
        opcionesRespuesta = [];
      }
      linea = linea.replace(/^\d+[.\-\s)]+/, "");
      enunciadoPregunta.push(linea);
      enPregunta = true;
    } else if (/^[a-z]\)[\s]*\S/.test(lineaLimpiada)) {
      linea = linea.replace(/^\w\)\s*/, "");
      const esCorrecta = linea.includes("*");
      if (esCorrecta) {
        linea = linea.replace(/\*/, "");
      }
      opcionesRespuesta.push({ texto: linea.trim(), esCorrecta });
    } else if (/^feedback\s+alternativa\s+correcta:/i.test(lineaLimpiada)) {
      retroalimentacionCorrecta = lineaLimpiada
        .replace(/^feedback\s+alternativa\s+correcta:/i, "")
        .trim();
    } else if (/^feedback\s+alternativa\s+incorrecta:/i.test(lineaLimpiada)) {
      retroalimentacionIncorrecta = lineaLimpiada
        .replace(/^feedback\s+alternativa\s+incorrecta:/i, "")
        .trim();
    } else {
      if (enPregunta) {
        enunciadoPregunta.push(linea);
      }
    }
  });

  if (enPregunta) {
    numeroPregunta++;
    const textoEnunciado = enunciadoPregunta.join("\n").trim();
    if (textoEnunciado) {
      if (agregarNegritaAlEnunciado) {
        textoConvertido += `::Pregunta ${numeroPregunta
          .toString()
          .padStart(2, "0")}::<strong>${textoEnunciado}</strong> {\n`;
      } else {
        textoConvertido += `::Pregunta ${numeroPregunta
          .toString()
          .padStart(2, "0")}::${textoEnunciado} {\n`;
      }

      opcionesRespuesta.forEach((opcion) => {
        const textoOpcion = opcion.texto.trim();
        if (opcion.esCorrecta) {
          textoConvertido += `=${textoOpcion}`;
          if (retroalimentacionCorrecta) {
            textoConvertido += `#${retroalimentacionCorrecta}`;
          }
          textoConvertido += "\n";
        } else {
          textoConvertido += `~${textoOpcion}`;
          if (retroalimentacionIncorrecta) {
            textoConvertido += `#${retroalimentacionIncorrecta}`;
          }
          textoConvertido += "\n";
        }
      });

      textoConvertido += "}\n\n";
    }
  }

  const archivo = new Blob([textoConvertido], {
    type: "text/plain;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = window.URL.createObjectURL(archivo);
  a.download = "evaluacion_moodle.txt";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function borrarContenido() {
  const area = document.getElementById("area-texto");
  if (area) area.value = "";
  const areaEmp = document.getElementById("area-texto-emparejamiento");
  if (areaEmp) areaEmp.value = "";
}
