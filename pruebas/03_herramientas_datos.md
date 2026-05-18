# 📊 Guía de Pruebas: Herramientas de Procesamiento de Datos

Este documento describe el manual de uso y los casos de prueba para el set de utilidades lógicas de procesamiento: **Comparador de Datos (Excel)**, **Normalizador de Nombres** y **Normalizador de RUTs**.

---

## 🛠️ Funcionalidad 1: Comparador de Datos (Excel)

Esta potente herramienta cruza información de dos planillas Excel diferentes y extrae las diferencias o coincidencias según la regla seleccionada.

### 📋 Pasos para el Usuario:
1. Dirígete a la sección **Comparador de Datos** desde el menú lateral.
2. Carga los dos archivos a comparar:
   * **Archivo 1 (Base):** La planilla de referencia.
   * **Archivo 2 (Comparar):** La planilla que deseas auditar.
3. El sistema leerá ambos archivos e identificará las **hojas activas**. Si lo deseas, puedes cambiar la hoja a analizar usando los selectores que aparecerán dinámicamente.
4. Rellena los parámetros de rango de celdas para **ambos archivos**:
   * **Columna de Búsqueda:** La letra de la columna que contiene el identificador clave (ej: `A` para RUTs, nombres, etc.).
   * **Fila de Inicio:** Fila donde comienzan los datos (ej: `2`, omitiendo la cabecera).
5. Selecciona el **Tipo de Reporte** deseado:
   * `Faltantes en Archivo 2`: Datos que están en el Archivo 1 pero no en el 2.
   * `Existentes en Ambos`: Intersección exacta de datos.
6. Haz clic en **"Procesar y Comparar"**.
7. La plataforma procesará el cruce y **descargará automáticamente** una planilla Excel con el reporte generado, indicando los registros correspondientes y agregando una hoja detallada con las filas cruzadas completas.

### 🖼️ Demostración Visual:
![Uso de Comparador de Excel](./media/comparador_excel.gif)

### 🧪 Caso de Prueba:
* **Entradas:**
  * **Archivo 1:** Excel con la columna A conteniendo: `Juan`, `Pedro`, `María`. (Fila inicio: 1)
  * **Archivo 2:** Excel con la columna A conteniendo: `Juan`, `Pedro`. (Fila inicio: 1)
  * **Tipo de Reporte:** `Faltantes en Archivo 2`
* **Resultado Esperado:** 
  1. El sistema procesa los archivos sin errores.
  2. Descarga un archivo Excel llamado `Reporte_XXXXXXXX_XXXXXX.xlsx`.
  3. Al abrir el reporte, este contiene únicamente el registro `María` como faltante, junto con los datos de su fila original de origen.

---

## 🛠️ Funcionalidad 2: Normalizador de Nombres

Limpia listas de nombres desordenadas quitando espacios extraños, caracteres especiales, mayúsculas incorrectas y tildes según sea requerido.

### 📋 Pasos para el Usuario:
1. Dirígete a la sección **Normalizador de Nombres** en el menú.
2. Pega tu listado de nombres en el cuadro de texto de la izquierda (un nombre por línea).
3. Selecciona las opciones de normalización:
   * **Limpieza de caracteres especiales:** Quita símbolos no deseados.
   * **Quitar tildes (Acentos):** Convierte `á, é, í` en `a, e, i` para evitar problemas en bases de datos.
4. Haz clic en **"Normalizar Nombres"**.
5. Los nombres limpios aparecerán en el cuadro de la derecha listos para copiar.

### 🖼️ Demostración Visual:
![Uso de Normalizador de Nombres](./media/normalizador_nombres.webp)

### 🧪 Caso de Prueba:
* **Entrada:**
  ```text
  jUAN   pÉREZ
  mAría  cArriZo!!
  ```
* **Opciones:** Quitar tildes + Limpieza activados.
* **Resultado Esperado:**
  ```text
  Juan Perez
  Maria Carrizo
  ```

---

## 🛠️ Funcionalidad 3: Normalizador de RUT (Chile)

Valida y da formato profesional a números de identificación chilenos (RUT).

### 📋 Pasos para el Usuario:
1. Dirígete a la sección **Normalizador de RUT** en el menú.
2. Pega el listado de números en el cuadro izquierdo (uno por línea, pueden tener puntos, guiones o estar en bruto).
3. Configura el formato de salida:
   * **Con puntos y guion:** Convierte `12345678k` en `12.345.678-K`.
   * **Solo con guion:** Convierte `12345678k` en `12345678-K`.
   * **Limpiar (Solo números):** Deja solo dígitos y dígito verificador.
4. Haz clic en **"Normalizar RUTs"**.
5. Los resultados se listarán a la derecha ordenados y clasificados (RUTs Válidos e Inválidos).

### 🖼️ Demostración Visual:
![Uso de Normalizador de RUT](./media/normalizador_rut.webp)

### 🧪 Caso de Prueba:
* **Entrada:**
  ```text
  19.123456-k
  112223334
  999-invalid
  ```
* **Formato de salida:** Con puntos y guion.
* **Resultado Esperado:**
  * **Válidos:**
    ```text
    19.123.456-K
    11.222.333-4
    ```
  * **Inválidos:**
    ```text
    999-invalid (Marcado con error de dígito verificador o formato)
    ```
