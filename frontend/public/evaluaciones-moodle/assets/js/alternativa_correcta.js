document
  .getElementById("botonCargarEvaluacion")
  .addEventListener("click", function () {
    document.getElementById("inputArchivo").click();
  });

document.getElementById("inputArchivo").addEventListener("change", function () {
  const inputArchivo = document.getElementById("inputArchivo");
  const archivo = inputArchivo.files[0];

  if (!archivo) {
    alert("Por favor selecciona un archivo .docx");
    return;
  }

  const lector = new FileReader();
  lector.onload = async function (evento) {
    const contenido = evento.target.result;
    const zip = await JSZip.loadAsync(contenido);
    const docXml = await zip.file("word/document.xml").async("string");

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, "application/xml");

    const coloresResaltado = {};
    const coloresSombreado = {};

    const ejecuciones = xmlDoc.getElementsByTagName("w:r");

    for (let ejecucion of ejecuciones) {
      const resaltado = ejecucion.getElementsByTagName("w:highlight")[0];
      if (resaltado) {
        const colorResaltado = resaltado.getAttribute("w:val");
        if (colorResaltado) {
          if (!coloresResaltado[colorResaltado]) {
            coloresResaltado[colorResaltado] = 0;
          }
          coloresResaltado[colorResaltado] += 1;
        }
      }

      const sombreado = ejecucion.getElementsByTagName("w:shd")[0];
      if (sombreado) {
        const colorSombreado = sombreado.getAttribute("w:fill");
        if (colorSombreado && colorSombreado !== "auto") {
          if (!coloresSombreado[colorSombreado]) {
            coloresSombreado[colorSombreado] = 0;
          }
          coloresSombreado[colorSombreado] += 1;
        }
      }
    }

    let colorDominanteResaltado = "";
    let maximoConteoResaltado = 0;
    for (const color in coloresResaltado) {
      if (coloresResaltado[color] > maximoConteoResaltado) {
        maximoConteoResaltado = coloresResaltado[color];
        colorDominanteResaltado = color;
      }
    }

    let colorDominanteSombreado = "";
    let maximoConteoSombreado = 0;
    for (const color in coloresSombreado) {
      if (coloresSombreado[color] > maximoConteoSombreado) {
        maximoConteoSombreado = coloresSombreado[color];
        colorDominanteSombreado = color;
      }
    }

    let colorDominante = "";
    if (maximoConteoResaltado >= maximoConteoSombreado) {
      colorDominante = colorDominanteResaltado;
    } else {
      colorDominante = colorDominanteSombreado;
    }

    let esPrimeraEjecucionResaltada = true;

    for (let ejecucion of ejecuciones) {
      const resaltado = ejecucion.getElementsByTagName("w:highlight")[0];
      const sombreado = ejecucion.getElementsByTagName("w:shd")[0];
      const elementoTexto = ejecucion.getElementsByTagName("w:t")[0];

      let colorDetectado = null;
      if (resaltado) {
        colorDetectado = resaltado.getAttribute("w:val");
      } else if (sombreado) {
        colorDetectado = sombreado.getAttribute("w:fill");
      }

      if (elementoTexto && colorDetectado === colorDominante) {
        if (esPrimeraEjecucionResaltada) {
          elementoTexto.textContent = "*" + elementoTexto.textContent;
          esPrimeraEjecucionResaltada = false;
        }
      } else {
        esPrimeraEjecucionResaltada = true;
      }
    }

    const serializador = new XMLSerializer();
    const docXmlModificado = serializador.serializeToString(xmlDoc);
    zip.file("word/document.xml", docXmlModificado);

    const zipModificado = await zip.generateAsync({ type: "blob" });
    saveAs(zipModificado, "Evaluación_Modificada.docx");
  };

  lector.readAsArrayBuffer(archivo);
});
