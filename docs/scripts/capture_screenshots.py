"""
Captura pantallas para MANUAL_USUARIO_PLATAFORMA_BEX.md
Uso: py docs/scripts/capture_screenshots.py
"""
import asyncio
import os
import re
from pathlib import Path

BASE_URL = os.getenv("CAPTURE_BASE_URL", "http://localhost:3000")
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

        async def shot(name: str, full_page: bool = False):
            path = OUT_DIR / name
            await page.screenshot(path=str(path), full_page=full_page)
            print(f"  OK {name}")

        # 01 Login
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        await shot("01-login.png")

        # Login
        await page.fill('input[type="text"]', USER)
        await page.fill('input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_url(f"{BASE_URL}/**", timeout=15000)
        await page.wait_for_timeout(1500)

        # 02 Menu
        await shot("02-menu-lateral.png")

        # 03 Apariencia
        await page.click('button:has-text("Apariencia")')
        await page.wait_for_timeout(800)
        await shot("03-apariencia.png")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)

        # 04-06 Comparador
        await page.goto(f"{BASE_URL}/", wait_until="networkidle")
        await page.wait_for_timeout(800)
        await shot("04-comparador-vista.png", full_page=True)
        await shot("05-comparador-archivos.png")

        repo_root = Path(__file__).resolve().parents[2]
        sample_xlsx = next(
            (f for f in repo_root.glob("*.xlsx") if "MATRIZ" not in f.name.upper()),
            None,
        )
        if sample_xlsx:
            try:
                inputs = page.locator('input[type="file"]')
                await inputs.nth(0).set_input_files(str(sample_xlsx))
                await inputs.nth(1).set_input_files(str(sample_xlsx))
                await page.wait_for_timeout(500)
                await shot("05-comparador-archivos.png")
                await page.get_by_role("button", name=re.compile("Comenzar comparación", re.I)).click()
                await page.wait_for_timeout(8000)
                await shot("06-comparador-resultado.png", full_page=True)
            except Exception as e:
                print(f"  skip comparador resultado: {e}")

        # 07 RUT
        await page.goto(f"{BASE_URL}/rut", wait_until="networkidle")
        await page.fill("textarea", "12.345.678-9\n9876543-2")
        await page.wait_for_timeout(500)
        await shot("07-rut.png", full_page=True)

        # 08 Textos
        await page.goto(f"{BASE_URL}/textos", wait_until="networkidle")
        await page.fill("textarea", "juan perez\ngarcia lopez")
        await shot("08-textos.png", full_page=True)

        # 09-10 Capacitaciones
        await page.goto(f"{BASE_URL}/capacitaciones", wait_until="networkidle")
        await shot("09-capacitaciones.png", full_page=True)
        try:
            btn = page.get_by_role("button", name=re.compile("Nueva Capacitación", re.I)).first
            if await btn.count() > 0:
                await btn.click()
                await page.wait_for_timeout(600)
                await shot("10-capacitaciones-form.png")
                await page.keyboard.press("Escape")
        except Exception:
            pass

        # 11 Enlaces
        await page.goto(f"{BASE_URL}/enlaces", wait_until="networkidle")
        await shot("11-enlaces.png", full_page=True)

        # 12-14 Recordatorios
        await page.goto(f"{BASE_URL}/recordatorios", wait_until="networkidle")
        await shot("12-recordatorios-calendario.png", full_page=True)
        try:
            await page.get_by_role("button", name=re.compile("Nueva Tarea", re.I)).first.click()
            await page.wait_for_timeout(600)
            await shot("13-recordatorios-tarea.png")
            await page.keyboard.press("Escape")
        except Exception:
            pass
        try:
            await page.locator('button[title="Configuración SMTP"]').click()
            await page.wait_for_timeout(600)
            await shot("14-recordatorios-smtp.png")
            await page.keyboard.press("Escape")
        except Exception:
            pass

        # 15-18 Generador
        await page.goto(f"{BASE_URL}/generador", wait_until="networkidle")
        await shot("15-generador-paso1.png", full_page=True)

        if sample_xlsx:
            try:
                inp = page.locator('input[type="file"]').first
                await inp.set_input_files(str(sample_xlsx))
                await page.wait_for_timeout(4000)
                await shot("16-generador-paso2.png", full_page=True)
                await page.get_by_role("button", name=re.compile("Configurar Mapeo", re.I)).click()
                await page.wait_for_timeout(1200)
                await page.locator("#grupo").fill("Grupo Induccion Manual BEX")
                await shot("17-generador-paso3.png", full_page=True)
                await page.get_by_role("button", name=re.compile("Previsualizar 10 Filas", re.I)).click()
                await page.wait_for_timeout(5000)
                await shot("18-generador-paso4.png", full_page=True)
            except Exception as e:
                print(f"  skip generador steps: {e}")

        # 19-20 Admin
        await page.goto(f"{BASE_URL}/admin/usuarios", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await shot("19-admin-usuarios.png", full_page=True)
        await page.locator('select').first.select_option("user")
        await page.locator('input[type="checkbox"]').first.check()
        await page.wait_for_timeout(400)
        await shot("20-permisos-usuario.png", full_page=True)

        await browser.close()
    print(f"\nCapturas en: {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
