import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

CURSOS_BEX_MOODLE_NAMES = (
    "cursos bex Moodle.xlsx",
    "cursos bex Moodle.xls",
    "cursos_bex_Moodle.xlsx",
    "cursos_bex_Moodle.xls",
)


def resolve_all_matriz_paths() -> list[str]:
    """Todos los archivos de matriz encontrados (sin duplicar rutas)."""
    if env_path := os.getenv("MATRIZ_CURSOS_PATH"):
        if os.path.isfile(env_path):
            return [env_path]

    seen: set[str] = set()
    paths: list[str] = []
    for name in CURSOS_BEX_MOODLE_NAMES:
        for base in (PROJECT_ROOT, BACKEND_DIR):
            p = base / name
            key = str(p.resolve())
            if p.is_file() and key not in seen:
                seen.add(key)
                paths.append(str(p))
    return paths


def resolve_matriz_cursos_path() -> str | None:
    """Ruta principal (primera encontrada); usar resolve_all_matriz_paths para fusionar."""
    all_paths = resolve_all_matriz_paths()
    return all_paths[0] if all_paths else None
