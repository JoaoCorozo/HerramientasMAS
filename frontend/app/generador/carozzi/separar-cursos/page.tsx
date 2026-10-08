"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, FileSpreadsheet, Play } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CursoItem {
  courseid: string
  curso: string
  shortname: string
  filas: number
}

interface ReportStats {
  total: number
  activos: number
  inactivos: number
  ids_solicitados: string[]
  ids_encontrados: string[]
  ids_sin_filas: string[]
}

function parseIdsTexto(texto: string): string[] {
  const parts = texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const cid = p.endsWith(".0") ? p.slice(0, -2) : p
    if (!cid || seen.has(cid)) continue
    seen.add(cid)
    out.push(cid)
  }
  return out
}

export default function CarozziSepararCursosPage() {
  useAuth()

  const [archivo, setArchivo] = useState<File | null>(null)
  const [cursos, setCursos] = useState<CursoItem[]>([])
  const [idsActivos, setIdsActivos] = useState<Set<string>>(new Set())
  const [idsTexto, setIdsTexto] = useState("")
  const [loadingListar, setLoadingListar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const syncTextoDesdeSet = (next: Set<string>) => {
    setIdsTexto([...next].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)).join(", "))
  }

  const toggleId = (courseid: string, checked: boolean) => {
    setIdsActivos((prev) => {
      const next = new Set(prev)
      if (checked) next.add(courseid)
      else next.delete(courseid)
      syncTextoDesdeSet(next)
      return next
    })
  }

  const aplicarTextoIds = (texto: string) => {
    setIdsTexto(texto)
    const parsed = parseIdsTexto(texto)
    setIdsActivos(new Set(parsed))
  }

  const handleArchivo = async (file: File | null) => {
    setArchivo(file)
    setCursos([])
    setIdsActivos(new Set())
    setIdsTexto("")
    setErrorMsg("")
    setSuccessMsg("")
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg("El archivo debe ser CSV (.csv).")
      return
    }

    setLoadingListar(true)
    try {
      const formData = new FormData()
      formData.append("archivo_cursos", file)
      const response = await apiFetch("/api/generador/carozzi/cursos-aprobados/listar", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          typeof err.detail === "string" ? err.detail : "No se pudo leer el listado de cursos."
        )
      }
      const data = (await response.json()) as { cursos: CursoItem[] }
      setCursos(data.cursos || [])
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al listar cursos.")
    } finally {
      setLoadingListar(false)
    }
  }

  const handleSeparar = async () => {
    if (!archivo) {
      setErrorMsg("Selecciona el CSV de cursos aprobados.")
      return
    }
    const ids = [...idsActivos]
    if (!ids.length) {
      setErrorMsg("Selecciona o escribe al menos un ID de curso activo.")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const formData = new FormData()
      formData.append("archivo_cursos", archivo)
      formData.append("ids_activos", ids.join(","))

      const response = await apiFetch("/api/generador/carozzi/cursos-aprobados/separar", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          typeof err.detail === "string" ? err.detail : "Error al separar cursos activos/inactivos."
        )
      }

      const statsHeader = response.headers.get("X-Report-Stats")
      let stats: ReportStats | null = null
      if (statsHeader) {
        try {
          stats = JSON.parse(statsHeader) as ReportStats
        } catch {
          stats = null
        }
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const contentDisposition = response.headers.get("content-disposition")
      let filename = "Carozzi_Cursos_Activos_Inactivos.xlsx"
      if (contentDisposition?.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "")
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      if (stats) {
        const sinFilas =
          stats.ids_sin_filas?.length
            ? ` IDs sin filas: ${stats.ids_sin_filas.join(", ")}.`
            : ""
        setSuccessMsg(
          `Excel generado: ${stats.activos} activos, ${stats.inactivos} inactivos ` +
            `(total ${stats.total}).${sinFilas}`
        )
      } else {
        setSuccessMsg("Excel descargado correctamente.")
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl min-w-0 px-8 py-8">
          <Link
            href="/generador"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a selección de cliente
          </Link>

          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Generador de Cargas · Carozzi
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Separar cursos activos / inactivos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sube el CSV «listado cursos aprobados por usuarios», elige los{" "}
              <code className="text-xs">courseid</code> que deben quedar activos y descarga un Excel
              con hojas Resumen, Activos e Inactivos.
            </p>
          </header>

          <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="archivo-cursos">1. Listado cursos aprobados (CSV)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivo ? archivo.name : "Ningún archivo seleccionado"}
                  {loadingListar ? " · leyendo cursos…" : ""}
                </span>
                <input
                  ref={fileRef}
                  id="archivo-cursos"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => void handleArchivo(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ids-activos">2. IDs activos (escribir o seleccionar)</Label>
              <Input
                id="ids-activos"
                placeholder="Ej. 10, 12"
                value={idsTexto}
                onChange={(e) => aplicarTextoIds(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separados por coma, espacio o punto y coma. El resto de cursos irá a Inactivos.
              </p>
            </div>

            {cursos.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Cursos detectados en el CSV ({cursos.length})</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const all = new Set(cursos.map((c) => c.courseid))
                        setIdsActivos(all)
                        syncTextoDesdeSet(all)
                      }}
                    >
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIdsActivos(new Set())
                        setIdsTexto("")
                      }}
                    >
                      Ninguno
                    </Button>
                  </div>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {cursos.map((c) => {
                    const checked = idsActivos.has(c.courseid)
                    return (
                      <label
                        key={c.courseid}
                        className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleId(c.courseid, v === true)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="font-medium text-foreground">ID {c.courseid}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.curso || c.shortname || "(sin nombre)"} · {c.filas} filas
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                {successMsg}
              </div>
            )}

            <Button
              type="button"
              className="gap-2"
              disabled={loading || loadingListar || !archivo || idsActivos.size === 0}
              onClick={() => void handleSeparar()}
            >
              <Play className="h-4 w-4" />
              {loading ? "Separando…" : "Separar y descargar Excel"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
