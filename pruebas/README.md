# 🧪 Centro de Pruebas y Manuales de Usuario

¡Bienvenido al directorio de aseguramiento de calidad e instrucciones de uso de la **Plataforma Herramientas Web**!

Este espacio está destinado a documentar y guiar tanto la ejecución de **pruebas de software** (para asegurar que todo funcione de manera óptima) como a servir de **guía práctica de usuario** para cada módulo del sistema.

---

## 📂 Contenido de esta Carpeta

Hemos estructurado la documentación en guías detalladas para cada funcionalidad:

1. [**01. Módulo de Recordatorios y Calendario**](./01_recordatorios.md)
   * Registro manual de tareas (Título, Curso, Grupo, Asunto, Detalles).
   * Sistema de copiado rápido de rutas locales (`Copiar Ruta`).
   * **Asistente de Importación Masiva (Excel Wizard):** Cómo pegar los datos, mapear campos, validar de forma interactiva y confirmar la carga.
   
2. [**02. Catálogo de Enlaces y Base de Capacitaciones**](./02_enlaces_y_capacitaciones.md)
   * Creación, edición, búsqueda inteligente y filtrado por categoría/empresa.
   * Enlaces directos a portales externos.
   
3. [**03. Herramientas de Procesamiento de Datos**](./03_herramientas_datos.md)
   * **Comparador de Datos (Excel):** Carga de dos archivos, configuración de rangos y columnas, y generación del reporte de diferencias.
   * **Normalizador de Nombres:** Limpieza automática de mayúsculas, tildes y caracteres extraños.
   * **Normalizador de RUTs:** Validación y formateo automático de identificadores nacionales (Chile).

---

## ⚙️ Cómo ejecutar pruebas locales de forma correcta

Para probar la plataforma en tu entorno local sin afectar los datos reales en producción, asegúrate de seguir este flujo:

1. **Entorno Limpio:** Ejecuta `Iniciar_Web.bat` para iniciar los servidores locales usando tu base de datos SQLite rápida (`users.db`).
2. **Crear Datos de Prueba:** Registra usuarios, recordatorios o enlaces de prueba.
3. **Validar en el Navegador:** Abre `http://localhost:3000` y ejecuta cada uno de los casos de prueba descritos en las guías individuales.
4. **Resguardar Cambios:** Si todo funciona y deseas subir estos datos de prueba a la nube, ejecuta `Sincronizar_a_la_Nube.bat`. De lo contrario, puedes simplemente borrar o recrear tu `users.db` local.

---

*Desliza o haz clic en las guías de arriba para comenzar a revisar y testear cada uno de los módulos.*
