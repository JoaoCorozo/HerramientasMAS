"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  FileSpreadsheet,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface MatrizPreview {
  nombre_grupo: string
  headers: string[]
  preview_rows: string[][]
  total: number
  warnings: {
    emails_invalidos: string[]
    omitidos_sin_x: string[]
    omitidos_duplicado: string[]
  }
}

export default function TranselecMatrizPage() {
  useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<MatrizPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadForm = () => {
    const fd = new FormData()
    if (!file) throw new Error("Selecciona un archivo.")
    fd.append("file", file)
    return fd
  }

  const handlePreview = async () => {
    if (!file) {
      setErrorMsg("Selecciona un archivo Excel o CSV.")
      return
    }
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch("/api/generador/transelec/matriz/preview", {
        method: "POST",
        body: uploadForm(),
      })
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

  const handleGenerar = async () => {
    if (!file) return
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch("/api/generador/transelec/matriz/generar", {
        method: "POST",
        body: uploadForm(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Error al generar.")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disp = res.headers.get("content-disposition")
      let name = "Script_Grupo.csv"
      if (disp?.includes("filename=")) {
        name = disp.split("filename=")[1].replace(/"/g, "").trim()
      }
      a.download = name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
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
            href="/generador/transelec"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Transelec
          </Link>

          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Transelec
                </p>
                <h1 className="text-2xl font-semibold text-foreground">Externos</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Script para generar nómina de ingresos externos en los cursos Subestaciones y/o Líneas de transmisión.
                  Matriz: Nombre, RUT, Email y marcas X. Grupo automático con fecha del día.
                </p>
              </div>
            </div>
          </header>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/10 p-10 text-center hover:bg-muted/20"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setPreview(null)
                  setErrorMsg("")
                }}
              />
              <Upload className="mb-4 h-10 w-10 text-primary/80" />
              <span className="font-semibold text-foreground">
                {file ? file.name : "Seleccionar planilla Externos (Excel o CSV)"}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handlePreview} disabled={loading || !file}>
                Previsualizar
              </Button>
              <Button onClick={handleGenerar} disabled={loading || !file} className="gap-2">
                <Play className="h-4 w-4" />
                Generar CSV
              </Button>
            </div>
          </div>

          {preview && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <strong>{preview.total}</strong> filas válidas · Grupo: <strong>{preview.nombre_grupo}</strong>
              </div>

              {(w?.emails_invalidos?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">Correos inválidos ({w!.emails_invalidos.length}) — se generará igual</p>
                  <ul className="mt-2 max-h-32 overflow-auto text-xs">
                    {w!.emails_invalidos.slice(0, 10).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

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
            </div>
          )}

          {errorMsg && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {errorMsg}
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
