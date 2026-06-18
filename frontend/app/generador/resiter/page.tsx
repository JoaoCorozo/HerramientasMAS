"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  ClipboardPaste,
  FileSpreadsheet,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface ResiterPreview {
  headers: string[]
  preview_rows: string[][]
  total: number
  warnings: {
    omitidos_perfil: string[]
    omitidos_duplicado: string[]
    rut_dudoso: string[]
  }
}

const TEXTO_EJEMPLO = `RUT
Nombre Colaborador a capacitar
Correo Colaborador a capacitar
Cargo Colaborador a capacitar
CeCo (indicar número)
Perfil SAP
Cápsula a solicitar
13906158-6
Rodrigo Antonio Asenjo Cespedes
rasenjo@resiter.cl
Gerente Negocio Minería
1902-50
Perfil Operacional
Sap Business`

export default function ResiterPage() {
  useAuth()

  const [tab, setTab] = useState<"archivo" | "texto">("archivo")
  const [file, setFile] = useState<File | null>(null)
  const [texto, setTexto] = useState("")
  const [preview, setPreview] = useState<ResiterPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const resetPreview = () => {
    setPreview(null)
    setErrorMsg("")
    setSuccessMsg("")
  }

  const handlePreview = async () => {
    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      let res: Response
      if (tab === "archivo") {
        if (!file) {
          setErrorMsg("Selecciona un archivo CSV o Excel.")
          return
        }
        const fd = new FormData()
        fd.append("file", file)
        res = await apiFetch("/api/generador/resiter/preview", { method: "POST", body: fd })
      } else {
        if (!texto.trim()) {
          setErrorMsg("Pega la matriz o los datos de colaboradores.")
          return
        }
        res = await apiFetch("/api/generador/resiter/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto }),
        })
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Error al previsualizar.")
      }
      setPreview(await res.json())
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error inesperado.")
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const descargarCsv = async (res: Response) => {
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    let filename = "Resiter_script.csv"
    const contentDisposition = res.headers.get("content-disposition")
    if (contentDisposition?.includes("filename=")) {
      filename = contentDisposition.split("filename=")[1].replace(/"/g, "")
    }
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
    setSuccessMsg(`CSV descargado: ${filename}`)
  }

  const handleGenerar = async () => {
    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      let res: Response
      if (tab === "archivo") {
        if (!file) {
          setErrorMsg("Selecciona un archivo CSV o Excel.")
          return
        }
        const fd = new FormData()
        fd.append("file", file)
        res = await apiFetch("/api/generador/resiter/generar", { method: "POST", body: fd })
      } else {
        if (!texto.trim()) {
          setErrorMsg("Pega la matriz o los datos de colaboradores.")
          return
        }
        res = await apiFetch("/api/generador/resiter/generar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto }),
        })
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Error al generar el CSV.")
      }
      await descargarCsv(res)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const w = preview?.warnings

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl min-w-0 px-8 py-8">
          <Link
            href="/generador"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a selección de cliente
          </Link>

          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Generador de Cargas · Resiter
                </p>
                <h1 className="text-2xl font-semibold text-foreground">Matriz SAP</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sube CSV/Excel o pega la matriz del cliente. Genera CSV Moodle con cursos según perfil
                  operacional, administrativo o CRM.
                </p>
              </div>
            </div>
          </header>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "archivo" | "texto")
              resetPreview()
            }}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="archivo" className="gap-2">
                <Upload className="h-4 w-4" />
                Archivo
              </TabsTrigger>
              <TabsTrigger value="texto" className="gap-2">
                <ClipboardPaste className="h-4 w-4" />
                Pegar texto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="archivo">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/10 p-10 text-center hover:bg-muted/20"
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null)
                      resetPreview()
                    }}
                  />
                  <Upload className="mb-4 h-10 w-10 text-primary/80" />
                  <span className="font-semibold text-foreground">
                    {file ? file.name : "Seleccionar matriz Resiter (CSV o Excel)"}
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="texto">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-3">
                <Textarea
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value)
                    resetPreview()
                  }}
                  placeholder="Pega encabezados y filas como los envía el cliente…"
                  className="min-h-[280px] font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setTexto(TEXTO_EJEMPLO)
                    resetPreview()
                  }}
                >
                  Insertar ejemplo
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handlePreview} disabled={loading}>
              Previsualizar
            </Button>
            <Button onClick={handleGenerar} disabled={loading} className="gap-2">
              <Play className="h-4 w-4" />
              Generar CSV
            </Button>
          </div>

          {preview && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <strong>{preview.total}</strong> colaboradores válidos para generar.
              </div>

              {(w?.omitidos_perfil?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  <p className="font-semibold">
                    Omitidos por perfil ({w!.omitidos_perfil.length})
                  </p>
                  <ul className="mt-2 max-h-40 overflow-auto text-xs">
                    {w!.omitidos_perfil.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(w?.omitidos_duplicado?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">RUT duplicados omitidos ({w!.omitidos_duplicado.length})</p>
                  <ul className="mt-2 max-h-32 overflow-auto text-xs">
                    {w!.omitidos_duplicado.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(w?.rut_dudoso?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">RUT con formato dudoso ({w!.rut_dudoso.length})</p>
                  <ul className="mt-2 max-h-32 overflow-auto text-xs">
                    {w!.rut_dudoso.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.total > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-auto max-h-80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          {preview.headers.map((h) => (
                            <th key={h} className="p-2 font-semibold whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview_rows.map((row, i) => (
                          <tr key={i} className="border-t border-border/50">
                            {row.map((cell, j) => (
                              <td key={j} className="p-2 whitespace-nowrap text-muted-foreground">
                                {cell || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="p-2 text-xs text-muted-foreground border-t border-border">
                    Mostrando hasta 15 filas de previsualización.
                  </p>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
              {successMsg}
            </div>
          )}

          {loading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <RefreshCw className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
