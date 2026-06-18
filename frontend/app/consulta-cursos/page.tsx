"use client"

import { useState } from "react"
import { FileSpreadsheet, Play, Download } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface PreviewSummary {
  total_registros: number
  total_cursos: number
  total_usuarios: number
  cursos: { curso_id: string; curso: string; registros: number }[]
}

export default function ConsultaCursosPage() {
  useAuth()
  const [inputText, setInputText] = useState("")
  const [preview, setPreview] = useState<PreviewSummary | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handlePreview = async () => {
    if (!inputText.trim()) return
    setLoadingPreview(true)
    setErrorMsg("")
    setPreview(null)

    try {
      const response = await apiFetch("/api/consulta-cursos/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: inputText }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || "No se pudo analizar el texto")
      }

      setPreview(await response.json())
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Error de conexión")
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleDownload = async () => {
    if (!inputText.trim()) return
    setLoadingExcel(true)
    setErrorMsg("")

    try {
      const response = await apiFetch("/api/consulta-cursos/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: inputText }),
      })

      if (!response.ok) {
        let detail = "Error al generar el Excel"
        try {
          const err = await response.json()
          detail = err.detail || detail
        } catch {
          /* respuesta no JSON */
        }
        throw new Error(detail)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const contentDisposition = response.headers.get("content-disposition")
      let filename = "Consulta_Cursos.xlsx"
      if (contentDisposition?.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "")
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Error de conexión")
    } finally {
      setLoadingExcel(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Reporte Consulta Cursos
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pegue el resultado de la consulta Moodle y genere un Excel con una hoja por cada curso detectado.
                </p>
              </div>
            </div>
          </header>

          <div className="mb-6 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 text-lg font-medium text-card-foreground">Texto de entrada</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Copie y pegue todo el bloque desde «Resultado Consulta» o desde la primera línea «Curso: … (ID …)».
              Puede incluir varios cursos y paginación; se ignorará automáticamente.
            </p>
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                setPreview(null)
              }}
              placeholder="Curso: Inducción BancoEstado Express 2025 (ID 41)&#10;Usuario&#9;Nombre&#9;Apellido&#9;..."
              className="min-h-[320px] w-full resize-y rounded-lg border border-input bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handlePreview} disabled={loadingPreview || !inputText.trim()}>
                <Play className="mr-2 h-4 w-4" />
                {loadingPreview ? "Analizando…" : "Vista previa"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleDownload}
                disabled={loadingExcel || !inputText.trim()}
              >
                <Download className="mr-2 h-4 w-4" />
                {loadingExcel ? "Generando…" : "Descargar Excel"}
              </Button>
            </div>

            {errorMsg && (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </p>
            )}
          </div>

          {preview && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-medium text-card-foreground">Resumen detectado</h2>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-2xl font-semibold text-foreground">{preview.total_registros}</p>
                  <p className="text-sm text-muted-foreground">Registros</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-2xl font-semibold text-foreground">{preview.total_cursos}</p>
                  <p className="text-sm text-muted-foreground">Cursos</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-2xl font-semibold text-foreground">{preview.total_usuarios}</p>
                  <p className="text-sm text-muted-foreground">Usuarios únicos</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">ID</th>
                      <th className="py-2 pr-4 font-medium">Curso</th>
                      <th className="py-2 font-medium">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cursos.map((c) => (
                      <tr key={c.curso_id} className="border-b border-border/50">
                        <td className="py-2 pr-4">{c.curso_id}</td>
                        <td className="py-2 pr-4">{c.curso}</td>
                        <td className="py-2">{c.registros}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
