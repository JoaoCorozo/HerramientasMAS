# 📅 Guía de Pruebas: Módulo de Recordatorios

Este documento describe el funcionamiento esperado y los casos de prueba para el módulo de **Recordatorios y Calendario**, el cual incluye la creación individual de tareas y el **Asistente de Importación Masiva (Excel Wizard)**.

---

## 🛠️ Funcionalidad 1: Creación Manual y Gestión de Tareas

El calendario permite agendar tareas seleccionando una fecha y registrando los metadatos de la actividad.

### 📋 Pasos para el Usuario:
1. Navega a la sección **Recordatorios** desde el menú lateral.
2. Selecciona un día en el calendario.
3. Haz clic en **"Nuevo Recordatorio"** (botón azul superior).
4. Rellena el formulario:
   * **Título:** Nombre de la tarea (Obligatorio).
   * **Detalle:** Descripción de la actividad.
   * **Curso ID:** Identificador numérico del curso.
   * **Grupo / Asunto:** Datos adicionales de organización.
   * **Ruta de Windows:** Ruta de tu disco local (ej. `C:\Proyectos\Ventas`).
5. Haz clic en **Guardar**.
6. **Copiar Ruta:** Haz clic en el botón azul `Copiar Ruta` sobre la tarjeta de la tarea. Comprueba que el botón cambia a `¡Copiado!` y la ruta se guarda en tu portapapeles.
7. **Completar:** Haz clic en el círculo de check a la izquierda del título. La tarea se tachará y se volverá opaca.

### 🧪 Caso de Prueba:
* **Entrada:** Crear una tarea el día de hoy con título "Reunión de Coordinación", ruta `D:\Empresa\Minuta.pdf`.
* **Resultado Esperado:** 
  1. La tarea aparece listada en el día correspondiente.
  2. Al presionar `Copiar Ruta`, el portapapeles tiene exactamente `D:\Empresa\Minuta.pdf`.
  3. Al presionar F5 (recargar), la tarea se mantiene guardada (persistencia local/nube confirmada).

---

## 🚀 Funcionalidad 2: Asistente de Importación Masiva (Excel Wizard)

Esta es una de las herramientas más potentes del módulo. Permite copiar filas enteras directamente de una hoja de cálculo (Excel) y procesarlas de forma interactiva paso a paso.

### 📋 Pasos para el Usuario:
1. En la pantalla de Recordatorios, haz clic en **"Importar desde Excel"** (botón verde superior).
2. Abre tu archivo Excel de planificación de tareas y **copia las filas** que desees importar (incluyendo las columnas de fecha, título, detalle, etc.).
3. Regresa a la plataforma y pega los datos copiados (Ctrl + V) en el cuadro de texto del modal.
4. Haz clic en **"Iniciar Asistente"**.
5. **Paso 1: Mapear Columnas.**
   * Asocia las columnas que detectó el sistema con los campos reales de la aplicación (ej: Columna 0 -> Fecha, Columna 1 -> Título, etc.).
   * Selecciona el formato de fecha que tiene tu Excel (ej. `DD-MM-YYYY` o `YYYY-MM-DD`).
   * Haz clic en **"Siguiente: Validar Tareas"**.
6. **Paso 2: Validación e Importación Paso a Paso.**
   * El asistente te mostrará las tareas procesadas una a una.
   * Si alguna tarea tiene errores (por ejemplo, fecha inválida o falta el título), el asistente la marcará en rojo y te permitirá **corregir el campo en caliente** escribiendo en pantalla.
   * Puedes presionar **"Importar Tarea"** para guardarla, **"Saltar Tarea"** si no deseas agregarla, o hacer clic en **"Importar Restantes Directo"** para saltarte la revisión manual y procesar todo de golpe.

### 🧪 Caso de Prueba:
* **Entrada:** Pegar las siguientes líneas de prueba en el cuadro:
  ```text
  15/06/2026	Clase de Matemáticas	Resolver guía número 3	102	Grupo A	C:\Clases\Mate
  16/06/2026	Laboratorio Física	Entrega de informe final	105	Grupo B	C:\Clases\Fisica
  ```
* **Resultado Esperado:**
  1. El sistema detecta 2 filas con 6 columnas.
  2. Mapear: Columna 0 (Fecha), Columna 1 (Título), Columna 2 (Detalle), Columna 3 (Curso ID), Columna 4 (Grupo/Asunto), Columna 5 (Ruta). Formato de fecha: `DD/MM/YYYY`.
  3. Al iniciar la validación, la primera tarea carga todos los datos correctamente.
  4. Tras confirmar la importación, las dos tareas aparecen agendadas de forma automática en el calendario en los días 15 y 16 de junio de 2026 respectivamente.
