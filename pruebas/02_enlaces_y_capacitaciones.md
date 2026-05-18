# 🔗 Guía de Pruebas: Catálogo de Enlaces y Base de Capacitaciones

Este documento detalla las pautas de uso y verificación para los módulos relacionales de información: **Catálogo de Enlaces** y **Base de Capacitaciones**.

---

## 🛠️ Funcionalidad 1: Catálogo de Enlaces

Este módulo sirve como repositorio central de URLs útiles, organizadas por empresa o categoría de negocio.

### 📋 Pasos para el Usuario:
1. Dirígete a la sección **Enlaces** desde el menú lateral.
2. Haz clic en **"Nuevo Enlace"** (botón azul superior).
3. Rellena los datos de la tarjeta:
   * **Título:** Nombre identificador (ej: *Portal de Autoconsulta Enaex*).
   * **URL / Enlace:** Dirección web (ej: `enaex.cl` o `https://enaex.com`). *Nota: Si no escribes `https://`, el sistema lo añadirá de forma inteligente por ti.*
   * **Empresa / Categoría:** Categoría organizadora (ej: *Enaex*, *Soporte*, *Interno*).
   * **Notas:** Texto aclaratorio o instructivo para el enlace.
4. Presiona **Guardar Enlace**.
5. **Filtrado por Categoría:** Usa el selector de la esquina superior derecha para elegir una empresa específica (ej: *Enaex*). La vista debe filtrar las tarjetas instantáneamente.
6. **Buscador:** Escribe en la barra de búsqueda superior. El catálogo buscará en tiempo real coincidencias por Título, Empresa o Notas.
7. **Acceso:** Presiona el botón verde **"IR"** en la tarjeta. Se abrirá la dirección en una pestaña nueva del navegador.

### 🖼️ Demostración Visual:
![Uso del Catálogo de Enlaces](./media/catalogo_enlaces.gif)

### 🧪 Caso de Prueba:
* **Entrada:** Crear un enlace con título "Manual de Procedimientos", URL "google.com", categoría "Interno", y notas "Solo lectura".
* **Resultado Esperado:**
  1. El enlace se autoguarda con la URL convertida a `https://google.com`.
  2. La tarjeta adopta un color pastel distintivo según su categoría "Interno" de manera automática.
  3. Al escribir "Manual" o "Interno" en el buscador, la tarjeta se mantiene visible mientras que enlaces de otras categorías desaparecen.
  4. Al hacer clic en "IR", el navegador abre `https://google.com` en una nueva pestaña.

---

## 🛠️ Funcionalidad 2: Base de Capacitaciones

Módulo diseñado para documentar cursos, capacitaciones internas, códigos de acceso y material de estudio.

### 📋 Pasos para el Usuario:
1. Dirígete a la sección **Capacitaciones** desde el menú lateral.
2. Haz clic en **"Nueva Capacitación"** (botón azul superior).
3. Rellena los campos solicitados:
   * **Curso ID:** Código único numérico o alfanumérico del curso (Obligatorio).
   * **Nombre del Curso:** Título de la capacitación.
   * **Plataforma:** Dónde se realiza (ej: *Sence*, *Coursera*, *E-learning*).
   * **Ruta de Acceso:** URL del portal del curso.
   * **Clave de Acceso / Notas:** Códigos de autenticación o instrucciones.
4. Presiona **Guardar Curso**.
5. Realiza búsquedas usando la barra superior por Nombre del Curso o Curso ID.

### 🖼️ Demostración Visual:
![Uso de la Base de Capacitaciones](./media/base_capacitaciones.gif)

### 🧪 Caso de Prueba:
* **Entrada:** Crear un curso con ID "CAP-2026", Nombre "Inducción de Seguridad", Plataforma "Mutual", URL "mutual.cl".
* **Resultado Esperado:**
  1. El curso se guarda y se lista ordenadamente en forma de fila o tarjeta.
  2. Al presionar el botón de enlace directo, se abre `https://mutual.cl` en una nueva pestaña.
  3. Al buscar "CAP-2026" en la barra de búsqueda, la capacitación se filtra correctamente.
