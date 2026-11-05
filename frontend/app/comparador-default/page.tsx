"use client"

import { useRef, useState } from "react"
import { AlertCircle, FileSpreadsheet, Plus, Play, Trash2 } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface InspectInfo {
  nombre: string
  columnas: string[]
  filas: number
  hojas: string[]
}

interface ReportStats {
  coinciden: number
  no_coinciden: number
  solo_nomina1: number
  solo_nomina2: number
  nomina1: number
  nomina2: number
  fuente: string
}

interface MapeoRow {
  id: string
  col1: string
  col2: string
}

function newMapeo(): MapeoRow {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, col1: "", col2: "" }
}

export default function ComparadorDefaultPage() {
  useAuth()

  const [archivo1, setArchivo1] = useState<File | null>(null)
  const [archivo2, setArchivo2] = useState<File | null>(null)
  const [info1, setInfo1] = useState<InspectInfo | null>(null)
  const [info2, setInfo2] = useState<InspectInfo | null>(null)
  const [hoja1, setHoja1] = useState("")
  const [hoja2, setHoja2] = useState("")
  const [mapeos, setMapeos] = useState<MapeoRow[]>([newMapeo()])
  const [fuente, setFuente] = useState<"1" | "2">("1")
  const [loadingInspect, setLoadingInspect] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const ref1 = useRef<HTMLInputElement>(null)
  const ref2 = useRef<HTMLInputElement>(null)

  const esPlanilla = (file: File) => /\.(xlsx|xls|csv)$/i.test(file.name)

  const inspect = async (f1: File, f2: File, h1?: string, h2?: string) => {
    setLoadingInspect(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      const formData = new FormData()
      formData.append("archivo1", f1)
      formData.append("archivo2", f2)
      if (h1) formData.append("hoja1", h1)
      if (h2) formData.append("hoja2", h2)
      const response = await apiFetch("/api/comparador-default/inspect", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(typeof err.detail === "string" ? err.detail : "No se pudieron leer las nóminas.")
      }
      const data = (await response.json()) as { nomina1: InspectInfo; nomina2: InspectInfo }
      setInfo1(data.nomina1)
      setInfo2(data.nomina2)
      if (!h1 && data.nomina1.hojas?.length) setHoja1(data.nomina1.hojas[0])
      if (!h2 && data.nomina2.hojas?.length) setHoja2(data.nomina2.hojas[0])
    } catch (e: unknown) {
      setInfo1(null)
      setInfo2(null)
      setErrorMsg(e instanceof Error ? e.message : "Error al inspeccionar.")
    } finally {
      setLoadingInspect(false)
    }
  }

  const onPick1 = (file: File | null) => {
    setArchivo1(file)
    setInfo1(null)
    setHoja1("")
    if (file && archivo2) void inspect(file, archivo2)
  }

  const onPick2 = (file: File | null) => {
    setArchivo2(file)
    setInfo2(null)
    setHoja2("")
    if (file && archivo1) void inspect(archivo1, file)
  }

  const handleComparar = async () => {
    if (!archivo1 || !archivo2) {
      setErrorMsg("Selecciona las dos nóminas.")
      return
    }
    const pares = mapeos
      .map((m) => ({ col1: m.col1.trim(), col2: m.col2.trim() }))
      .filter((m) => m.col1 && m.col2)
    if (!pares.length) {
      setErrorMsg("Elige al menos un par de campos (nómina 1 ↔ nómina 2).")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      const formData = new FormData()
      formData.append("archivo1", archivo1)
      formData.append("archivo2", archivo2)
      formData.append("mapeos", JSON.stringify(pares))
      formData.append("fuente", fuente)
      if (hoja1) formData.append("hoja1", hoja1)
      if (hoja2) formData.append("hoja2", hoja2)

      const response = await apiFetch("/api/comparador-default/comparar", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(typeof err.detail === "string" ? err.detail : "Error al comparar.")
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
      let filename = "Comparador_Default.xlsx"
      if (contentDisposition?.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "")
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      if (stats) {
        setSuccessMsg(
          `Coinciden: ${stats.coinciden} · No coinciden: ${stats.no_coinciden} ` +
            `(solo N1: ${stats.solo_nomina1}, solo N2: ${stats.solo_nomina2}). ` +
            `Datos predominantes: Nómina ${stats.fuente}.`
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

  const cols1 = info1?.columnas ?? []
  const cols2 = info2?.columnas ?? []
  const listo = Boolean(archivo1 && archivo2 && cols1.length && cols2.length)

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl min-w-0 px-8 py-8">
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Comparador
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Comparador Default</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Compara dos nóminas (CSV o Excel) por los campos que elijas. Puedes mapear columnas con
              nombres distintos (ej. RUT ↔ C.I). El Excel de salida tiene hojas Coinciden y No
              coinciden; tú decides de qué nómina sale la información.
            </p>
          </header>

          <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>1. Nómina 1 (CSV / Excel)</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => ref1.current?.click()}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Seleccionar
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {archivo1 ? archivo1.name : "Sin archivo"}
                  </span>
                  <input
                    ref={ref1}
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      if (f && !esPlanilla(f)) {
                        setErrorMsg("Nómina 1 debe ser Excel o CSV.")
                        return
                      }
                      onPick1(f)
                    }}
                  />
                </div>
                {info1 && (
                  <p className="text-xs text-muted-foreground">
                    {info1.filas} filas · {info1.columnas.length} columnas
                  </p>
                )}
                {info1?.hojas && info1.hojas.length > 1 && (
                  <Select
                    value={hoja1}
                    onValueChange={(v) => {
                      setHoja1(v)
                      if (archivo1 && archivo2) void inspect(archivo1, archivo2, v, hoja2 || undefined)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Hoja Excel" />
                    </SelectTrigger>
                    <SelectContent>
                      {info1.hojas.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>2. Nómina 2 (CSV / Excel)</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => ref2.current?.click()}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Seleccionar
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {archivo2 ? archivo2.name : "Sin archivo"}
                  </span>
                  <input
                    ref={ref2}
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      if (f && !esPlanilla(f)) {
                        setErrorMsg("Nómina 2 debe ser Excel o CSV.")
                        return
                      }
                      onPick2(f)
                    }}
                  />
                </div>
                {info2 && (
                  <p className="text-xs text-muted-foreground">
                    {info2.filas} filas · {info2.columnas.length} columnas
                  </p>
                )}
                {info2?.hojas && info2.hojas.length > 1 && (
                  <Select
                    value={hoja2}
                    onValueChange={(v) => {
                      setHoja2(v)
                      if (archivo1 && archivo2) void inspect(archivo1, archivo2, hoja1 || undefined, v)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Hoja Excel" />
                    </SelectTrigger>
                    <SelectContent>
                      {info2.hojas.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {loadingInspect && (
              <p className="text-sm text-muted-foreground">Leyendo columnas…</p>
            )}

            {listo && (
              <>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>3. Campos a comparar (Nómina 1 ↔ Nómina 2)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setMapeos((prev) => [...prev, newMapeo()])}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar campo
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {mapeos.map((m) => (
                      <div key={m.id} className="flex flex-wrap items-center gap-2">
                        <Select
                          value={m.col1 || undefined}
                          onValueChange={(v) =>
                            setMapeos((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, col1: v } : x))
                            )
                          }
                        >
                          <SelectTrigger className="min-w-[160px] flex-1">
                            <SelectValue placeholder="Campo nómina 1" />
                          </SelectTrigger>
                          <SelectContent>
                            {cols1.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">↔</span>
                        <Select
                          value={m.col2 || undefined}
                          onValueChange={(v) =>
                            setMapeos((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, col2: v } : x))
                            )
                          }
                        >
                          <SelectTrigger className="min-w-[160px] flex-1">
                            <SelectValue placeholder="Campo nómina 2" />
                          </SelectTrigger>
                          <SelectContent>
                            {cols2.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={mapeos.length <= 1}
                          onClick={() => setMapeos((prev) => prev.filter((x) => x.id !== m.id))}
                          aria-label="Quitar mapeo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>4. Información que predomina en el resultado</Label>
                  <Select value={fuente} onValueChange={(v) => setFuente(v as "1" | "2")}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        Nómina 1{archivo1 ? ` (${archivo1.name})` : ""}
                      </SelectItem>
                      <SelectItem value="2">
                        Nómina 2{archivo2 ? ` (${archivo2.name})` : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    En Coinciden se usan las columnas de esa nómina. En No coinciden, las filas solo
                    presentes en la otra se muestran con sus propios datos.
                  </p>
                </div>
              </>
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
              disabled={loading || loadingInspect || !listo}
              onClick={() => void handleComparar()}
            >
              <Play className="h-4 w-4" />
              {loading ? "Comparando…" : "Comparar y descargar Excel"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
