# Carpeta de capturas para el manual

Coloca aquí las imágenes en formato **PNG** con los nombres indicados en `MANUAL_USUARIO_PLATAFORMA_BEX.md`.

## Capturas automáticas (recomendado)

Con la app corriendo en `http://localhost:3000` y sesión `admin` / `admin123`:

```bash
py docs/scripts/capture_screenshots.py
```

Variables opcionales: `CAPTURE_BASE_URL`, `CAPTURE_USER`, `CAPTURE_PASSWORD`.

## Capturas manuales

1. Abre la app (local: `http://localhost:3000` o tu URL de Vercel).
2. Usa **Windows + Shift + S** (recorte) o **Impr Pant** y guarda en esta carpeta.
3. Resolución recomendada: ancho mínimo **1280 px**; recorta solo la zona relevante.
4. Nombra los archivos **exactamente** como en la lista del manual (ej. `01-login.png`).

## Lista rápida de archivos

| Archivo | Pantalla |
|---------|----------|
| `01-login.png` | Página de inicio de sesión |
| `02-menu-lateral.png` | Menú lateral con módulos visibles |
| `03-apariencia.png` | Panel Apariencia (engranaje) abierto |
| `04-comparador-vista.png` | Comparador de Datos completo |
| `05-comparador-archivos.png` | Tarjetas de carga de Excel |
| `06-comparador-resultado.png` | Descarga / resultado exitoso |
| `07-rut.png` | Normalizador RUT |
| `08-textos.png` | Normalizador Textos |
| `09-capacitaciones.png` | Tabla de capacitaciones |
| `10-capacitaciones-form.png` | Diálogo nueva capacitación |
| `11-enlaces.png` | Enlaces de interés |
| `12-recordatorios-calendario.png` | Calendario mensual |
| `13-recordatorios-tarea.png` | Formulario de tarea |
| `14-recordatorios-smtp.png` | Configuración SMTP |
| `15-generador-paso1.png` | Generador paso 1 – subir Excel |
| `16-generador-paso2.png` | Generador paso 2 – hoja y columnas |
| `17-generador-paso3.png` | Generador paso 3 – mapeo |
| `18-generador-paso4.png` | Generador paso 4 – previsualización |
| `19-admin-usuarios.png` | *(Opcional)* Administrar usuarios |
| `20-permisos-usuario.png` | *(Opcional)* Permisos de módulos |

El manual de usuario final usa las capturas 01–18. Las 19–20 son solo para documentación de administración.

Cuando existan, el manual mostrará las imágenes al exportar a PDF con `py docs/scripts/export_manual_pdf.py`.
