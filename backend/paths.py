import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent


def resolve_matriz_cursos_path() -> str | None:
    env_path = os.getenv("MATRIZ_CURSOS_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path

    candidates = [
        PROJECT_ROOT / "MATRIZ_CURSOS_BEX.xlsx",
        BACKEND_DIR / "MATRIZ_CURSOS_BEX.xlsx",
        Path(os.getcwd()) / "MATRIZ_CURSOS_BEX.xlsx",
        Path(os.getcwd()).parent / "MATRIZ_CURSOS_BEX.xlsx",
    ]
    for path in candidates:
        if path.is_file():
            return str(path)
    return None
