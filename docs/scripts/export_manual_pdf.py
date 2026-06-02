"""
Exporta MANUAL_USUARIO_PLATAFORMA_BEX.md a PDF con capturas embebidas.
Uso: py docs/scripts/export_manual_pdf.py
"""
from __future__ import annotations

import asyncio
import re
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1]
MD_FILE = DOCS / "MANUAL_USUARIO_PLATAFORMA_BEX.md"
OUT_PDF = DOCS / "Manual_Usuario_Plataforma_BEX.pdf"


def md_to_html(md: str) -> str:
    lines = md.splitlines()
    html: list[str] = []
    in_table = False
    list_tag: str | None = None

    def close_list():
        nonlocal list_tag
        if list_tag:
            html.append(f"</{list_tag}>")
            list_tag = None

    def close_table():
        nonlocal in_table
        if in_table:
            html.append("</tbody></table>")
            in_table = False

    def inline(text: str) -> str:
        text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
        text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
        text = re.sub(
            r"!\[([^\]]*)\]\(([^)]+)\)",
            lambda m: f'<figure><img src="{m.group(2)}" alt="{m.group(1)}"/><figcaption>{m.group(1)}</figcaption></figure>',
            text,
        )
        text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
        return text

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("![") and "](" in line:
            close_list()
            close_table()
            html.append(f"<p>{inline(line)}</p>")
            continue
        if line.startswith("# "):
            close_list()
            close_table()
            html.append(f"<h1>{inline(line[2:])}</h1>")
        elif line.startswith("## "):
            close_list()
            close_table()
            html.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.startswith("### "):
            close_list()
            close_table()
            html.append(f"<h3>{inline(line[4:])}</h3>")
        elif line.startswith("---"):
            close_list()
            close_table()
            html.append("<hr/>")
        elif line.startswith("|"):
            close_list()
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(set(c) <= {"-", ":", " "} for c in cells):
                continue
            if not in_table:
                html.append('<table class="data"><thead><tr>')
                for c in cells:
                    html.append(f"<th>{inline(c)}</th>")
                html.append("</tr></thead><tbody>")
                in_table = True
            else:
                html.append("<tr>")
                for c in cells:
                    html.append(f"<td>{inline(c)}</td>")
                html.append("</tr>")
        elif line.startswith("> "):
            close_table()
            close_list()
            html.append(f"<blockquote>{inline(line[2:])}</blockquote>")
        elif re.match(r"^\d+\.\s", line):
            close_table()
            if list_tag != "ol":
                close_list()
                html.append("<ol>")
                list_tag = "ol"
            item = re.sub(r"^\d+\.\s", "", line)
            html.append(f"<li>{inline(item)}</li>")
        elif line.startswith("- "):
            close_table()
            if list_tag != "ul":
                close_list()
                html.append("<ul>")
                list_tag = "ul"
            html.append(f"<li>{inline(line[2:])}</li>")
        elif not line.strip():
            close_list()
            close_table()
            html.append("<p class='spacer'>&nbsp;</p>")
        else:
            close_list()
            close_table()
            html.append(f"<p>{inline(line)}</p>")

    close_list()
    close_table()
    body = "\n".join(html)
    # Fix image paths to file://
    body = re.sub(
        r'src="capturas/([^"]+)"',
        lambda m: f'src="{(DOCS / "capturas" / m.group(1)).as_uri()}"',
        body,
    )
    return body


def build_document(body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Manual de usuario — Plataforma BEX</title>
<style>
  @page {{ size: A4; margin: 18mm 16mm 20mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: "Segoe UI", Calibri, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
    max-width: 100%;
  }}
  h1 {{ font-size: 20pt; color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 6px; margin-top: 0; page-break-after: avoid; }}
  h2 {{ font-size: 14pt; color: #0f4c81; margin-top: 1.4em; page-break-after: avoid; }}
  h3 {{ font-size: 11.5pt; color: #333; page-break-after: avoid; }}
  p {{ margin: 0.4em 0; }}
  blockquote {{ border-left: 4px solid #0f4c81; margin: 0.8em 0; padding: 0.4em 1em; background: #f0f6fc; color: #333; }}
  table.data {{ width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 9.5pt; }}
  table.data th, table.data td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; }}
  table.data th {{ background: #0f4c81; color: #fff; }}
  table.data tr:nth-child(even) td {{ background: #f7f9fb; }}
  figure {{ margin: 1em 0; page-break-inside: avoid; text-align: center; }}
  figure img {{ max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }}
  figcaption {{ font-size: 9pt; color: #555; margin-top: 4px; font-style: italic; }}
  code {{ background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }}
  hr {{ border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }}
  ul, ol {{ margin: 0.4em 0 0.8em 1.2em; }}
  a {{ color: #0f4c81; }}
  .cover {{
    text-align: center;
    padding: 3cm 1cm 2cm;
    page-break-after: always;
  }}
  .cover h1 {{ border: none; font-size: 26pt; }}
  .cover .meta {{ font-size: 12pt; color: #444; margin-top: 2em; }}
</style>
</head>
<body>
<div class="cover">
  <h1>Manual de usuario</h1>
  <p style="font-size:16pt;font-weight:600;">Plataforma de Herramientas BEX</p>
  <p class="meta">Guía para usuarios · Mayo 2026<br/>Uso interno — BEX</p>
</div>
{body}
</body>
</html>"""


async def main():
    md = MD_FILE.read_text(encoding="utf-8")
    html = build_document(md_to_html(md))
    html_path = DOCS / "_manual_export.html"
    html_path.write_text(html, encoding="utf-8")

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(html_path.as_uri(), wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.pdf(
            path=str(OUT_PDF),
            format="A4",
            print_background=True,
            margin={"top": "18mm", "bottom": "20mm", "left": "16mm", "right": "16mm"},
        )
        await browser.close()

    html_path.unlink(missing_ok=True)
    print(f"PDF generado: {OUT_PDF}")
    print(f"Tamaño: {OUT_PDF.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    asyncio.run(main())
