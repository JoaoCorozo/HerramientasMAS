"""
Captura pantallas para el manual de usuario (DOCX filtrado por permisos).

Inicia sesión contra el backend (cookie JWT) y luego abre el frontend,
para no depender del proxy /api del Next si falla el login por UI.

Uso:
  set CAPTURE_BASE_URL=http://localhost:3000
  set CAPTURE_BACKEND_URL=http://127.0.0.1:8000
  set CAPTURE_USER=admin
  set CAPTURE_PASSWORD=tu_clave
  py docs/scripts/capture_screenshots.py
"""
from __future__ import annotations

import asyncio
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

BASE_URL = os.getenv("CAPTURE_BASE_URL", "http://localhost:3000").rstrip("/")
BACKEND_URL = os.getenv("CAPTURE_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
USER = os.getenv("CAPTURE_USER", "admin")
PASSWORD = os.getenv("CAPTURE_PASSWORD", "admin123")
OUT_DIR = Path(__file__).resolve().parents[1] / "capturas"


def login_get_token() -> str:
    """POST form login al backend; retorna access_token."""
    body = urllib.parse.urlencode({"username": USER, "password": PASSWORD}).encode()
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/auth/login",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    try:
        with opener.open(req, timeout=30) as resp:
            _ = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(
            f"Login falló ({e.code}) en {BACKEND_URL}. "
            f"Revisa CAPTURE_USER/CAPTURE_PASSWORD.\n{detail}"
        ) from e

    for c in jar:
        if c.name == "access_token" and c.value:
            print(f"  Login OK como '{USER}' (cookie JWT)")
            return c.value
    raise SystemExit("Login OK pero no llegó cookie access_token")


async def main():
    from playwright.async_api import async_playwright

    token = login_get_token()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="es-CL",
        )
        # Cookie para el origen del frontend (y del backend si se usa directo)
        for origin in (BASE_URL, BACKEND_URL):
            await context.add_cookies(
                [
                    {
                        "name": "access_token",
                        "value": token,
                        "url": origin,
                        "httpOnly": True,
                        "sameSite": "Lax",
                    }
                ]
            )

        page = await context.new_page()

        # Si el proxy Next→backend falla, reenviar /api/* al backend real
        async def _proxy_api(route):
            req = route.request
            url = req.url
            # http://localhost:3000/api/foo → http://127.0.0.1:8000/api/foo
            path_q = url.split("/api/", 1)[-1]
            target = f"{BACKEND_URL}/api/{path_q}"
            headers = {
                k: v
                for k, v in req.headers.items()
                if k.lower() not in ("host", "content-length", "connection")
            }
            headers["cookie"] = f"access_token={token}"
            try:
                data = req.post_data_buffer
                r = await page.request.fetch(
                    target,
                    method=req.method,
                    headers=headers,
                    data=data,
                    timeout=60000,
                )
                body = await r.body()
                await route.fulfill(
                    status=r.status,
                    headers={
                        k: v
                        for k, v in r.headers.items()
                        if k.lower()
                        not in ("transfer-encoding", "content-encoding", "content-length")
                    },
                    body=body,
                )
            except Exception as e:
                await route.fulfill(status=502, body=str(e).encode())

        await page.route("**/api/**", _proxy_api)

        async def shot(name: str, full_page: bool = True):
            path = OUT_DIR / name
            await page.screenshot(path=str(path), full_page=full_page)
            print(f"  OK {name}")

        async def safe_goto(path: str) -> bool:
            await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(1500)
            url = page.url
            if "/login" in url:
                print(f"  AVISO: {path} redirigió a login ({url})")
                return False
            body_text = (await page.locator("body").inner_text()).lower()
            if "ingresa tus credenciales" in body_text and await page.locator(
                'input[type="password"]'
            ).count() > 0:
                print(f"  AVISO: {path} muestra formulario de login")
                return False
            return True

        # 01 Login (sin cookie en esta página a propósito)
        bare = await browser.new_context(viewport={"width": 1440, "height": 900}, locale="es-CL")
        login_page = await bare.new_page()
        await login_page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        await login_page.wait_for_timeout(800)
        await login_page.screenshot(path=str(OUT_DIR / "01-login.png"), full_page=False)
        print("  OK 01-login.png")
        await bare.close()

        # Verificar sesión en home
        ok = await safe_goto("/")
        if not ok:
            raise SystemExit(
                "No se pudo entrar autenticado al frontend. "
                "¿El proxy /api apunta al backend correcto? "
                f"BASE={BASE_URL} BACKEND={BACKEND_URL}"
            )
        await shot("02-menu-lateral.png", full_page=False)

        try:
            btn = page.get_by_role("button", name=re.compile("Apariencia|Tema|Theme", re.I)).first
            await btn.click(timeout=4000)
            await page.wait_for_timeout(600)
            await shot("03-apariencia.png", full_page=False)
            await page.keyboard.press("Escape")
        except Exception as e:
            print(f"  skip apariencia UI: {e}")
            await shot("03-apariencia.png", full_page=False)

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
                logged = await safe_goto(route)
                if not logged:
                    await shot(name)  # igual guardamos evidencia
                    continue
                if name == "07-rut.png":
                    ta = page.locator("textarea").first
                    if await ta.count():
                        await ta.fill("12.345.678-9\n9876543-2")
                        await page.wait_for_timeout(300)
                elif name == "08-textos.png":
                    ta = page.locator("textarea").first
                    if await ta.count():
                        await ta.fill("juan perez\ngarcia lopez")
                        await page.wait_for_timeout(300)
                elif name == "10-capacitaciones-form.png":
                    btn = page.get_by_role(
                        "button", name=re.compile("Nueva Capacitación", re.I)
                    ).first
                    if await btn.count():
                        await btn.click()
                        await page.wait_for_timeout(500)
                elif name == "13-recordatorios-tarea.png":
                    btn = page.get_by_role("button", name=re.compile("Nueva Tarea", re.I)).first
                    if await btn.count():
                        await btn.click()
                        await page.wait_for_timeout(500)
                elif name == "14-recordatorios-smtp.png":
                    btn = page.locator(
                        'button[title*="SMTP"], button[title*="correo"], button[title*="Correo"]'
                    ).first
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
