#!/usr/bin/env python3
"""Generador de paquetes de video para subida a plataforma Moodle."""

from __future__ import annotations

import html
import re
import shutil
import tkinter as tk
import zipfile
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

SCRIPT_DIR = Path(__file__).resolve().parent
PLANTILLA_DIR = SCRIPT_DIR.parent.parent / "backend" / "plantilla_video"

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"}
INVALID_FOLDER_CHARS = re.compile(r'[<>:"/\\|?*]')

INDEX2_TEMPLATE = """<html>

<head>
    <script type="text/javascript">
        location.href = {url_js};

    </script>
</head>
<body>
</body>
</html>
"""


def validar_nombre_carpeta(nombre: str) -> str | None:
    nombre = nombre.strip()
    if not nombre:
        return "Ingresa un nombre para la carpeta principal."
    if INVALID_FOLDER_CHARS.search(nombre):
        return 'El nombre no puede contener: < > : " / \\ | ? *'
    return None


def validar_url(url: str) -> str | None:
    url = url.strip()
    if not url:
        return "Ingresa la URL del curso."
    if not (url.startswith("http://") or url.startswith("https://")):
        return "La URL debe comenzar con http:// o https://"
    return None


def crear_index2(course_url: str) -> str:
    url_js = html.escape(course_url.strip(), quote=True)
    return INDEX2_TEMPLATE.format(url_js=f'"{url_js}"')


def copiar_plantilla(destino: Path) -> None:
    for item in PLANTILLA_DIR.iterdir():
        if item.name == "video.mp4":
            continue
        target = destino / item.name
        if item.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)


def generar_paquetes(
    carpeta_destino: Path,
    nombre_lote: str,
    course_url: str,
    videos_ordenados: list[Path],
    progress_callback=None,
) -> Path:
    if not PLANTILLA_DIR.is_dir():
        raise FileNotFoundError(f"No se encontró la plantilla en: {PLANTILLA_DIR}")

    lote_dir = carpeta_destino / nombre_lote.strip()
    lote_dir.mkdir(parents=True, exist_ok=True)

    index2_content = crear_index2(course_url)
    total = len(videos_ordenados)

    for index, video_path in enumerate(videos_ordenados, start=1):
        if progress_callback:
            progress_callback(index, total, video_path.name)

        paquete_dir = lote_dir / str(index)
        if paquete_dir.exists():
            shutil.rmtree(paquete_dir)
        paquete_dir.mkdir(parents=True)

        copiar_plantilla(paquete_dir)
        shutil.copy2(video_path, paquete_dir / "video.mp4")
        (paquete_dir / "index2.html").write_text(index2_content, encoding="utf-8")

        zip_path = lote_dir / f"{index}.zip"
        if zip_path.exists():
            zip_path.unlink()

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in sorted(paquete_dir.rglob("*")):
                if file_path.is_file():
                    zf.write(file_path, file_path.relative_to(paquete_dir).as_posix())

    return lote_dir


class PasoUnoFrame(ttk.Frame):
    def __init__(self, master, on_siguiente):
        super().__init__(master, padding=16)
        self.on_siguiente = on_siguiente
        self.videos: list[Path] = []
        self.carpeta_destino = tk.StringVar(value=str(Path.home() / "Desktop"))

        ttk.Label(self, text="Generador de paquetes de video", font=("Segoe UI", 14, "bold")).grid(
            row=0, column=0, columnspan=3, sticky="w", pady=(0, 12)
        )

        ttk.Label(self, text="Nombre de la carpeta principal:").grid(row=1, column=0, sticky="w")
        self.entry_nombre = ttk.Entry(self, width=50)
        self.entry_nombre.grid(row=1, column=1, columnspan=2, sticky="ew", pady=4)

        ttk.Label(self, text="URL del curso:").grid(row=2, column=0, sticky="w")
        self.entry_url = ttk.Entry(self, width=50)
        self.entry_url.grid(row=2, column=1, columnspan=2, sticky="ew", pady=4)
        self.entry_url.insert(0, "https://www.gestiondepersonasbex.cl/course/view.php?id=")

        ttk.Label(self, text="Carpeta de destino:").grid(row=3, column=0, sticky="w")
        ttk.Entry(self, textvariable=self.carpeta_destino, width=42).grid(
            row=3, column=1, sticky="ew", pady=4
        )
        ttk.Button(self, text="Examinar...", command=self._elegir_destino).grid(row=3, column=2, padx=(8, 0))

        ttk.Label(self, text="Videos seleccionados:").grid(row=4, column=0, sticky="nw", pady=(12, 0))
        list_frame = ttk.Frame(self)
        list_frame.grid(row=4, column=1, columnspan=2, sticky="nsew", pady=(12, 0))

        self.listbox = tk.Listbox(list_frame, height=10, width=58)
        self.listbox.pack(side="left", fill="both", expand=True)
        scroll = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        scroll.pack(side="right", fill="y")
        self.listbox.configure(yscrollcommand=scroll.set)

        btn_frame = ttk.Frame(self)
        btn_frame.grid(row=5, column=1, columnspan=2, sticky="w", pady=8)
        ttk.Button(btn_frame, text="Agregar videos...", command=self._agregar_videos).pack(side="left")
        ttk.Button(btn_frame, text="Quitar seleccionado", command=self._quitar_video).pack(side="left", padx=8)

        ttk.Button(self, text="Siguiente: ordenar videos", command=self._continuar).grid(
            row=6, column=2, sticky="e", pady=(16, 0)
        )

        self.columnconfigure(1, weight=1)
        self.rowconfigure(4, weight=1)

    def _elegir_destino(self):
        selected = filedialog.askdirectory(initialdir=self.carpeta_destino.get())
        if selected:
            self.carpeta_destino.set(selected)

    def _agregar_videos(self):
        paths = filedialog.askopenfilenames(
            title="Seleccionar videos",
            filetypes=[
                ("Videos", "*.mp4 *.mov *.avi *.webm *.mkv *.m4v"),
                ("Todos los archivos", "*.*"),
            ],
        )
        for raw_path in paths:
            path = Path(raw_path)
            if path.suffix.lower() not in VIDEO_EXTENSIONS:
                messagebox.showwarning("Formato no soportado", f"Se omitió: {path.name}")
                continue
            if path not in self.videos:
                self.videos.append(path)
                self.listbox.insert(tk.END, path.name)

    def _quitar_video(self):
        selection = self.listbox.curselection()
        if not selection:
            return
        index = selection[0]
        self.listbox.delete(index)
        del self.videos[index]

    def _continuar(self):
        nombre = self.entry_nombre.get()
        url = self.entry_url.get()
        destino = self.carpeta_destino.get().strip()

        error = validar_nombre_carpeta(nombre)
        if error:
            messagebox.showerror("Validación", error)
            return

        error = validar_url(url)
        if error:
            messagebox.showerror("Validación", error)
            return

        if not destino:
            messagebox.showerror("Validación", "Selecciona una carpeta de destino.")
            return

        if not Path(destino).is_dir():
            messagebox.showerror("Validación", "La carpeta de destino no existe.")
            return

        if not self.videos:
            messagebox.showerror("Validación", "Agrega al menos un video.")
            return

        self.on_siguiente(
            {
                "nombre_lote": nombre.strip(),
                "course_url": url.strip(),
                "carpeta_destino": Path(destino),
                "videos": list(self.videos),
            }
        )


class PasoDosFrame(ttk.Frame):
    def __init__(self, master, datos, on_generar, on_volver):
        super().__init__(master, padding=16)
        self.datos = datos
        self.on_generar = on_generar
        self.on_volver = on_volver
        self.videos: list[Path] = list(datos["videos"])

        ttk.Label(self, text="Orden de subida de videos", font=("Segoe UI", 14, "bold")).grid(
            row=0, column=0, columnspan=2, sticky="w", pady=(0, 8)
        )
        ttk.Label(
            self,
            text="Define el orden en que se subirán a la plataforma (1, 2, 3...).",
        ).grid(row=1, column=0, columnspan=2, sticky="w", pady=(0, 12))

        list_frame = ttk.Frame(self)
        list_frame.grid(row=2, column=0, sticky="nsew")

        self.listbox = tk.Listbox(list_frame, height=12, width=62)
        self.listbox.pack(side="left", fill="both", expand=True)
        scroll = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        scroll.pack(side="right", fill="y")
        self.listbox.configure(yscrollcommand=scroll.set)

        controls = ttk.Frame(self)
        controls.grid(row=2, column=1, sticky="ns", padx=(12, 0))
        ttk.Button(controls, text="Subir", width=14, command=self._subir).pack(pady=4)
        ttk.Button(controls, text="Bajar", width=14, command=self._bajar).pack(pady=4)

        self._refrescar_lista()

        btn_frame = ttk.Frame(self)
        btn_frame.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(16, 0))
        ttk.Button(btn_frame, text="Volver", command=on_volver).pack(side="left")
        ttk.Button(btn_frame, text="Generar paquetes y ZIPs", command=self._generar).pack(side="right")

        self.columnconfigure(0, weight=1)
        self.rowconfigure(2, weight=1)

    def _refrescar_lista(self):
        self.listbox.delete(0, tk.END)
        for index, video in enumerate(self.videos, start=1):
            self.listbox.insert(tk.END, f"{index}. {video.name}")

    def _subir(self):
        selection = self.listbox.curselection()
        if not selection or selection[0] == 0:
            return
        index = selection[0]
        self.videos[index - 1], self.videos[index] = self.videos[index], self.videos[index - 1]
        self._refrescar_lista()
        self.listbox.selection_set(index - 1)

    def _bajar(self):
        selection = self.listbox.curselection()
        if not selection or selection[0] >= len(self.videos) - 1:
            return
        index = selection[0]
        self.videos[index + 1], self.videos[index] = self.videos[index], self.videos[index + 1]
        self._refrescar_lista()
        self.listbox.selection_set(index + 1)

    def _generar(self):
        self.on_generar({**self.datos, "videos": list(self.videos)})


class GeneradorVideosApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Generador de paquetes de video")
        self.geometry("760x520")
        self.minsize(680, 460)

        self.container = ttk.Frame(self)
        self.container.pack(fill="both", expand=True)

        self.paso_actual: ttk.Frame | None = None
        self.mostrar_paso_uno()

    def _limpiar_container(self):
        if self.paso_actual is not None:
            self.paso_actual.destroy()
            self.paso_actual = None

    def mostrar_paso_uno(self):
        self._limpiar_container()
        self.paso_actual = PasoUnoFrame(self.container, on_siguiente=self.mostrar_paso_dos)
        self.paso_actual.pack(fill="both", expand=True)

    def mostrar_paso_dos(self, datos):
        self._limpiar_container()
        self.paso_actual = PasoDosFrame(
            self.container,
            datos=datos,
            on_generar=self.ejecutar_generacion,
            on_volver=self.mostrar_paso_uno,
        )
        self.paso_actual.pack(fill="both", expand=True)

    def ejecutar_generacion(self, datos):
        progress = tk.Toplevel(self)
        progress.title("Generando...")
        progress.geometry("420x120")
        progress.transient(self)
        progress.grab_set()

        label = ttk.Label(progress, text="Preparando...")
        label.pack(padx=16, pady=16, anchor="w")
        bar = ttk.Progressbar(progress, mode="determinate", maximum=len(datos["videos"]))
        bar.pack(fill="x", padx=16, pady=(0, 16))

        def actualizar(actual, total, nombre):
            label.config(text=f"Procesando {actual}/{total}: {nombre}")
            bar["value"] = actual
            progress.update_idletasks()

        try:
            lote_dir = generar_paquetes(
                carpeta_destino=datos["carpeta_destino"],
                nombre_lote=datos["nombre_lote"],
                course_url=datos["course_url"],
                videos_ordenados=datos["videos"],
                progress_callback=actualizar,
            )
        except Exception as exc:
            progress.destroy()
            messagebox.showerror("Error", str(exc))
            return

        progress.destroy()
        messagebox.showinfo(
            "Completado",
            f"Se generaron {len(datos['videos'])} paquetes en:\n{lote_dir}\n\n"
            f"Cada carpeta numerada incluye su ZIP correspondiente.",
        )
        self.mostrar_paso_uno()


def main():
    if not PLANTILLA_DIR.is_dir():
        messagebox.showerror(
            "Plantilla no encontrada",
            f"No existe la carpeta plantilla:\n{PLANTILLA_DIR}",
        )
        return

    app = GeneradorVideosApp()
    app.mainloop()


if __name__ == "__main__":
    main()
