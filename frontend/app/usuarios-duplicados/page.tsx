"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Download, Trash2, Upload, Users } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface DuplicateGroup {
  criterion: string
  criterion_label: string
  key: string
  match_detail?: string
  columns_involved?: string[]
  count: number
  rows: Record<string, string>[]
}

interface ScanResult {
  id: string
  filename: string
  analyzed_at: string
  total_rows: number
  duplicate_groups: number
  duplicate_rows: number
  rows_without_key: number
  by_criterion: Record<string, number>
  groups: DuplicateGroup[]
  columns: string[]
}

interface ScanSummary {
  id: string
  filename: string
  analyzed_at: string
  total_rows: number
  duplicate_groups: number
  duplicate_rows: number
  rows_without_key: number
  by_criterion: Record<string, number>
}

export default function UsuariosDuplicadosPage() {
  useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null)
  const [history, setHistory] = useState<ScanSummary[]>([])

  const loadHistory = async () => {
    try {
      const res = await apiFetch("/api/usuarios-duplicados/historial")
      if (res.ok) {
        const data = await res.json()
        setHistory(data.scans || [])
      }
    } catch {
      /* ignorar */
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setErrorMsg("")

    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await apiFetch("/api/usuarios-duplicados/analizar", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Error al analizar el archivo")
      }

      const scan = await res.json()
      setCurrentScan(scan)
      await loadHistory()
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const handleLoadScan = async (scanId: string) => {
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch(`/api/usuarios-duplicados/historial/${scanId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "No se pudo cargar el análisis")
      }
      setCurrentScan(await res.json())
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!currentScan?.id) return
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch("/api/usuarios-duplicados/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: currentScan.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Error al exportar")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const contentDisposition = res.headers.get("content-disposition")
      let filename = `Duplicados_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`
      if (contentDisposition?.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "").trim()
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = async () => {
    if (!confirm("¿Eliminar todo el historial de análisis guardados?")) return
    try {
      await apiFetch("/api/usuarios-duplicados/historial", { method: "DELETE" })
      setHistory([])
      setCurrentScan(null)
    } catch {
      setErrorMsg("No se pudo limpiar el historial")
    }
  }

  const columns = currentScan?.columns || [
    "id",
    "username",
    "firstname",
    "lastname",
    "email",
    "address",
    "idnumber",
    "institution",
    "suspended",
    "deleted",
  ]

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Revisor de Usuarios Duplicados
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cargue un export mdl_user (CSV o Excel). Agrupa duplicados por cruce{" "}
                  <strong>address ↔ idnumber ↔ username</strong> y, por separado, duplicados de{" "}
                  <strong>email</strong>.
                </p>
              </div>
            </div>
          </header>

          <div className="mb-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-medium">Archivo mdl_user</h2>
              <div className="mb-4 flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6">
                {file ? (
                  <span className="text-sm text-foreground">{file.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Seleccione CSV (;) o Excel exportado desde Moodle
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xlsm"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null)
                  setErrorMsg("")
                }}
              />
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <Button onClick={handleAnalyze} disabled={!file || loading}>
                  <Copy className="mr-2 h-4 w-4" />
                  {loading ? "Analizando…" : "Analizar duplicados"}
                </Button>
                {currentScan && (
                  <Button variant="secondary" onClick={handleExport} disabled={loading}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                  </Button>
                )}
              </div>
              {errorMsg && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Historial guardado</h2>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Limpiar
                  </Button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay análisis guardados.</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {history.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleLoadScan(item.id)}
                        className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="font-medium text-foreground">{item.filename}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.analyzed_at).toLocaleString("es-CL")} ·{" "}
                          {item.duplicate_groups} grupos · {item.duplicate_rows} filas
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {currentScan && (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Filas totales" value={currentScan.total_rows} />
                <StatCard label="Grupos duplicados" value={currentScan.duplicate_groups} />
                <StatCard label="Filas duplicadas" value={currentScan.duplicate_rows} />
                <StatCard label="Sin clave" value={currentScan.rows_without_key} />
                <StatCard
                  label="Grupos addr/idn/user · email"
                  value={`${currentScan.by_criterion?.address_idnumber ?? currentScan.by_criterion?.address ?? 0} / ${currentScan.by_criterion?.email ?? 0}`}
                />
              </div>

              {currentScan.duplicate_groups === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                  No se encontraron usuarios duplicados con los criterios configurados.
                </div>
              ) : (
                <div className="space-y-6">
                  {currentScan.groups.map((group, index) => (
                    <div key={`${group.criterion}-${group.key}-${index}`} className="rounded-xl border border-border bg-card p-6">
                      <div className="mb-4 flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                          Grupo {index + 1}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {group.criterion_label}: <strong className="text-foreground">{group.key}</strong>
                        </span>
                        {group.match_detail && (
                          <span className="text-xs text-muted-foreground">
                            Cruce: {group.match_detail}
                          </span>
                        )}
                        {group.columns_involved && group.columns_involved.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Columnas: {group.columns_involved.join(", ")}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {group.count} registros
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                              {columns.map((col) => (
                                <th key={col} className="px-3 py-2 font-medium">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row, rowIndex) => (
                              <tr key={`${group.key}-${row.id || row.username}-${rowIndex}`} className="border-b border-border/50">
                                {columns.map((col) => (
                                  <td key={col} className="px-3 py-2 align-top text-foreground">
                                    {row[col] || "—"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
