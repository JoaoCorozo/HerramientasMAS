"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Film,
  Package,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface VideoItem {
  id: string
  file: File
}

const DEFAULT_COURSE_URL = "https://www.gestiondepersonasbex.cl/course/view.php?id="

function parseApiErrorDetail(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback
  const detail = (data as { detail?: unknown }).detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "object" && item && "msg" in item) {
          return String((item as { msg: string }).msg)
        }
        return String(item)
      })
      .filter(Boolean)
    if (messages.length) return messages.join(" ")
  }
  return fallback
}

export default function GeneradorVideosPage() {
  useAuth()

  const [step, setStep] = useState(1)
  const [nombreLote, setNombreLote] = useState("")
  const [courseUrl, setCourseUrl] = useState(DEFAULT_COURSE_URL)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const addVideos = (files: FileList | null) => {
    if (!files?.length) return

    const next: VideoItem[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
      if (!["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(ext)) {
        setErrorMsg(`Formato no soportado: ${file.name}`)
        continue
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
      })
    }

    if (next.length) {
      setVideos((prev) => [...prev, ...next])
      setErrorMsg("")
    }
  }

  const removeVideo = (id: string) => {
    setVideos((prev) => prev.filter((item) => item.id !== id))
  }

  const moveVideo = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= videos.length) return
    setVideos((prev) => {
      const copy = [...prev]
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      return copy
    })
  }

  const validateStepOne = () => {
    if (!nombreLote.trim()) {
      setErrorMsg("Ingresa el nombre de la carpeta principal.")
      return false
    }
    if (!courseUrl.trim().startsWith("http://") && !courseUrl.trim().startsWith("https://")) {
      setErrorMsg("La URL del curso debe comenzar con http:// o https://")
      return false
    }
    if (!videos.length) {
      setErrorMsg("Agrega al menos un video.")
      return false
    }
    setErrorMsg("")
    return true
  }

  const handleGenerate = async () => {
    if (!videos.length) return

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const formData = new FormData()
      formData.append("nombre_lote", nombreLote.trim())
      formData.append("course_url", courseUrl.trim())
      videos.forEach((item) => formData.append("videos", item.file))

      const response = await apiFetch("/api/generador/videos/generar", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let detail = "No se pudieron generar los paquetes."
        try {
          const data = await response.json()
          detail = parseApiErrorDetail(data, detail)
        } catch {
          try {
            const text = await response.text()
            if (text.trim()) detail = text.slice(0, 300)
          } catch {
            /* sin cuerpo legible */
          }
          if (response.status === 413) {
            detail = "Los videos superan el tamaño máximo permitido."
          } else if (response.status === 401 || response.status === 403) {
            detail = "Sesión expirada. Vuelve a iniciar sesión."
          } else if (response.status >= 500) {
            detail =
              "Error en el servidor al generar los paquetes. Si los videos son muy pesados, prueba con menos archivos o reinicia la app con Iniciar_Web.bat."
          }
        }
        throw new Error(detail)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${nombreLote.trim()}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(anchor)

      setSuccessMsg(
        `Se generaron ${videos.length} paquetes numerados con sus ZIP individuales dentro del archivo descargado.`
      )
    } catch (err: unknown) {
      if (err instanceof TypeError && /fetch|network|failed/i.test(err.message)) {
        setErrorMsg(
          "No se pudo completar la subida. Los videos pueden ser muy grandes o la operación tardó demasiado. Reinicia con Iniciar_Web.bat e intenta de nuevo."
        )
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Error inesperado al generar los paquetes.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl min-w-0 px-8 py-8">
          <header className="mb-8">
            <Link
              href="/generador"
              className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a selección de cliente
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Generador de Cargas
                </p>
                <h1 className="text-2xl font-semibold text-foreground">Paquetes de Video</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Genera carpetas numeradas con la estructura HTML de reproducción y un ZIP por video listo
                  para subir a Moodle.
                </p>
              </div>
            </div>
          </header>

          <div className="mb-8 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm">
            <div className="mx-auto flex max-w-md items-center justify-between">
              {[
                { s: 1, label: "Datos y videos" },
                { s: 2, label: "Orden y generar" },
              ].map((stepInfo, idx) => (
                <div key={stepInfo.s} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (stepInfo.s === 1 || (stepInfo.s === 2 && validateStepOne())) {
                        setStep(stepInfo.s)
                      }
                    }}
                    disabled={stepInfo.s === 2 && !videos.length}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                      step === stepInfo.s
                        ? "scale-110 bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : step > stepInfo.s
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > stepInfo.s ? <Check className="h-4 w-4" /> : stepInfo.s}
                  </button>
                  <span
                    className={`ml-2 text-xs font-medium ${
                      step === stepInfo.s ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {stepInfo.label}
                  </span>
                  {idx === 0 && (
                    <div className={`mx-4 h-[2px] w-16 ${step > 1 ? "bg-primary/50" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-medium text-card-foreground">Configuración del lote</h2>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nombre-lote">Nombre de la carpeta principal</Label>
                    <Input
                      id="nombre-lote"
                      placeholder="Ej: Modulo3_Videos"
                      value={nombreLote}
                      onChange={(e) => setNombreLote(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="course-url">URL del curso seleccionado</Label>
                    <Input
                      id="course-url"
                      placeholder="https://www.gestiondepersonasbex.cl/course/view.php?id=207"
                      value={courseUrl}
                      onChange={(e) => setCourseUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Esta URL se usará en el `index2.html` de todos los paquetes generados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-medium text-card-foreground">Videos a procesar</h2>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/10 p-10 text-center transition-colors hover:bg-muted/20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp4,.mov,.avi,.webm,.mkv,.m4v,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addVideos(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <Upload className="mb-4 h-12 w-12 text-primary/80" />
                  <span className="text-base font-semibold text-foreground">
                    Selecciona uno o más videos
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    Formatos: MP4, MOV, AVI, WEBM, MKV, M4V
                  </span>
                </div>

                {videos.length > 0 && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/10 p-4">
                    <p className="mb-2 text-sm font-medium text-foreground">
                      {videos.length} video(s) seleccionado(s)
                    </p>
                    <ul className="space-y-2">
                      {videos.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                        >
                          <span className="truncate">{item.file.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeVideo(item.id)}>
                            Quitar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  className="gap-2"
                  onClick={() => {
                    if (validateStepOne()) setStep(2)
                  }}
                >
                  Ordenar videos <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-card-foreground">Orden de subida</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Define el orden en que se subirán a la plataforma. Cada posición generará una carpeta
                      numerada (`1`, `2`, `3`...) y su ZIP correspondiente.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" /> Volver
                  </Button>
                </div>

                <div className="space-y-2">
                  {videos.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary">Posición {index + 1}</p>
                        <p className="truncate text-sm text-foreground">{item.file.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => moveVideo(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => moveVideo(index, 1)}
                          disabled={index === videos.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Resultado esperado</p>
                    <p className="mt-1 text-muted-foreground">
                      Carpeta <strong>{nombreLote.trim() || "NombreLote"}</strong> con subcarpetas numeradas,
                      cada una con `index.html`, `index2.html`, `video.mp4` y assets, más archivos{" "}
                      <strong>1.zip</strong>, <strong>2.zip</strong>, etc.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-2 px-6 shadow-lg shadow-primary/20" onClick={handleGenerate} disabled={loading}>
                  <Play className="h-4 w-4" /> Generar y descargar ZIP
                </Button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
              <Package className="h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-xl">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <span className="block text-sm font-semibold text-foreground">Generando paquetes de video</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Copiando plantilla, renombrando videos y creando ZIPs...
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
