"""
Captura pantallas para el manual de usuario (DOCX filtrado por permisos).
Uso: py docs/scripts/capture_screenshots.py
"""
from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path

BASE_URL = os.getenv("CAPTURE_BASE_URL", "http://localhost:3000").rstrip("/")
USER = os.getenv("CAPTURE_USER", "admin")
PASSWORD = os.getenv("CAPTURE_PASSWORD", "admin123")
OUT_DIR = Path(__file__).resolve().parents[1] / "capturas"


async def main():
    from playwright.async_api import async_playwright

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="es-CL",
        )
        page = await context.new_page()

        async def shot(name: str, full_page: bool = True):
            path = OUT_DIR / name
            await page.screenshot(path=str(path), full_page=full_page)
            print(f"  OK {name}")

        async def safe_goto(path: str):
            await page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(700)

        # Login
        await safe_goto("/login")
        await shot("01-login.png", full_page=False)
        await page.fill('input[type="text"]', USER)
        await page.fill('input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(2000)
        await shot("02-menu-lateral.png", full_page=False)

        try:
            btn = page.get_by_role("button", name=re.compile("Apariencia|Tema|Theme", re.I)).first
            await btn.click(timeout=4000)
            await page.wait_for_timeout(600)
            await shot("03-apariencia.png", full_page=False)
            await page.keyboard.press("Escape")
        except Exception as e:
            print(f"  skip apariencia: {e}")
            await shot("03-apariencia.png", full_page=False)

        # Páginas principales (screenshot aunque falte un control)
        pages = [
            ("/", "04-comparador-vista.png"),
            ("/", "05-comparador-archivos.png"),
            ("/", "06-comparador-resultado.png"),
            ("/rut", "07-rut.png"),
            ("/textos", "08-textos.png"),
            ("/capacitaciones", "09-capacitaciones.png"),
            ("/capacitaciones", "10-capacitaciones-form.png"),
            ("/enlaces", "11-enlaces.png"),
            ("/recordatorios", "12-recordatorios-calendario.png"),
            ("/recordatorios", "13-recordatorios-tarea.png"),
            ("/recordatorios", "14-recordatorios-smtp.png"),
            ("/generador/bex", "15-generador-paso1.png"),
            ("/generador/bex", "16-generador-paso2.png"),
            ("/generador/bex", "17-generador-paso3.png"),
            ("/generador/bex", "18-generador-paso4.png"),
            ("/admin/usuarios", "19-admin-usuarios.png"),
            ("/admin/usuarios", "20-permisos-usuario.png"),
            ("/consulta-cursos", "21-consulta-cursos.png"),
            ("/usuarios-duplicados", "22-usuarios-duplicados.png"),
            ("/compresor-videos", "23-compresor-videos.png"),
            ("/evaluaciones-moodle", "24-evaluaciones-moodle.png"),
            ("/analisis-resultados", "25-analisis-resultados.png"),
        ]

        for route, name in pages:
            try:
                await safe_goto(route)
                # Interacciones ligeras opcionales
                if name == "07-rut.png":
                    ta = page.locator("textarea").first
                    if await ta.count():
                        await ta.fill("12.345.678-9\n9876543-2")
                elif name == "08-textos.png":
                    ta = page.locator("textarea").first
                    if await ta.count():
                        await ta.fill("juan perez\ngarcia lopez")
                elif name == "10-capacitaciones-form.png":
                    btn = page.get_by_role("button", name=re.compile("Nueva Capacitación", re.I)).first
                    if await btn.count():
                        await btn.click()
                        await page.wait_for_timeout(500)
                elif name == "13-recordatorios-tarea.png":
                    btn = page.get_by_role("button", name=re.compile("Nueva Tarea", re.I)).first
                    if await btn.count():
                        await btn.click()
                        await page.wait_for_timeout(500)
                elif name == "14-recordatorios-smtp.png":
                    btn = page.locator('button[title*="SMTP"], button[title*="correo"]').first
                    if await btn.count():
                        await btn.click()
                        await page.wait_for_timeout(500)
                await shot(name)
                await page.keyboard.press("Escape")
            except Exception as e:
                print(f"  skip {name}: {e}")

        await browser.close()
    print(f"\nCapturas en: {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
