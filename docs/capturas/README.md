# Carpeta de capturas para el manual

El manual (Markdown y Word in-app) usa **una captura de vista por módulo**, más login y menú.

## Capturas automáticas (recomendado)

Con la app corriendo en `http://localhost:3000`:

```bash
py docs/scripts/capture_screenshots.py
```

Variables opcionales: `CAPTURE_BASE_URL`, `CAPTURE_USER`, `CAPTURE_PASSWORD`.

## Usadas en el manual

| Archivo | Sección |
|---------|---------|
| `01-login.png` | Entrar a la plataforma |
| `02-menu-lateral.png` | Pantalla principal |
| `04-comparador-vista.png` | Comparador de Datos |
| `07-rut.png` | Normalizador RUT |
| `08-textos.png` | Normalizador Textos |
| `09-capacitaciones.png` | Capacitaciones |
| `11-enlaces.png` | Enlaces de interés |
| `12-recordatorios-calendario.png` | Calendario y tareas |
| `15-generador-paso1.png` | Generador de Nóminas |
| `19-admin-usuarios.png` | Panel de Administrador |
| `21-consulta-cursos.png` | Reporte Consulta Cursos |
| `23-compresor-videos.png` | Compresor MP4 |
| `24-evaluaciones-moodle.png` | Evaluaciones Moodle |
| `25-analisis-resultados.png` | Análisis de Resultados |

Las demás PNG del script de captura (pasos intermedios, apariencia, etc.) pueden quedar en la carpeta como referencia; el manual descargable ya no las incrusta.
