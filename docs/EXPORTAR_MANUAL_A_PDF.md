# Cómo exportar el manual a PDF (con capturas)

## 1. Completar las capturas

Sigue [capturas/README.md](capturas/README.md) y guarda los 20 PNG en `docs/capturas/`.

## 2. Ver el manual con imágenes

- En **VS Code**: extensión "Markdown Preview Enhanced" o vista previa nativa (`Ctrl+Shift+V`).
- En **GitHub**: sube la carpeta `docs/` y abre `MANUAL_USUARIO_PLATAFORMA_BEX.md`.

## 3. Exportar a PDF

### Opción A — Script automático (recomendado)

Con las 20 capturas en `docs/capturas/`:

```powershell
py docs/scripts/export_manual_pdf.py
```

Genera: **`docs/Manual_Usuario_Plataforma_BEX.pdf`** (portada + manual + imágenes).

### Opción B — VS Code + Markdown PDF

1. Instala la extensión **Markdown PDF**.
2. Abre `MANUAL_USUARIO_PLATAFORMA_BEX.md`.
3. Clic derecho → **Markdown PDF: Export (pdf)**.

### Opción C — Pandoc (línea de comandos)

```powershell
cd docs
pandoc MANUAL_USUARIO_PLATAFORMA_BEX.md -o Manual_BEX.pdf --resource-path=.
```

### Opción D — Word

1. Abre el `.md` en Word (arrastrar archivo) o copia desde la vista previa.
2. Ajusta márgenes y **Archivo → Guardar como PDF**.

## 4. Distribución interna

Recomendación: PDF + enlace a la app en la portada del documento.
