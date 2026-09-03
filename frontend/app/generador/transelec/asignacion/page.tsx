"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, FileSpreadsheet, Play } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface ReportStats {
  asignacion: number
  nomina: number
  encontrados: number
  faltan: number
  inconsistencias: number
}

export default function TranselecAsignacionPage() {
  useAuth()

  const [archivoAsignacion, setArchivoAsignacion] = useState<File | null>(null)
  const [archivoNomina, setArchivoNomina] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const asignacionRef = useRef<HTMLInputElement>(null)
  const nominaRef = useRef<HTMLInputElement>(null)

  const esExcel = (file: File) => /\.(xlsx|xls)$/i.test(file.name)
  const esCsv = (file: File) => file.name.toLowerCase().endsWith(".csv")

  const handleComparar = async () => {
    if (!archivoAsignacion || !archivoNomina) {
      setErrorMsg("Selecciona el Excel de Asignación y el CSV de Nómina.")
      return
    }
    if (!esExcel(archivoAsignacion)) {
      setErrorMsg("El archivo de Asignación debe ser Excel (.xlsx/.xls).")
      return
    }
    if (!esCsv(archivoNomina)) {
      setErrorMsg("El archivo de Nómina debe ser CSV (.csv).")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const formData = new FormData()
      formData.append("archivo_asignacion", archivoAsignacion)
      formData.append("archivo_nomina", archivoNomina)

      const response = await apiFetch("/api/generador/transelec/asignacion/comparar", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          typeof err.detail === "string" ? err.detail : "Error al comparar Asignación vs Nómina."
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
      let filename = "Reporte_Asignacion_Transelec.xlsx"
      if (contentDisposition?.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "")
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      if (stats) {
        const parts = [
          `OK ${stats.encontrados}/${stats.asignacion}`,
          `faltan ${stats.faltan}`,
          `inconsistencias ${stats.inconsistencias ?? 0}`,
        ]
        setSuccessMsg(`Reporte generado: ${parts.join(", ")}.`)
      } else {
        setSuccessMsg("Reporte Excel descargado correctamente.")
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
            href="/generador/transelec"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Transelec
          </Link>

          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Transelec
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Asignación Transelec</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Compara Asignación RH vs Nómina LMS: quién falta y casos donde el email/RUT/nombre
              no corresponden a la misma persona.
            </p>
          </header>

          <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="archivo-asignacion">Asignación (Excel)</Label>
              <input
                ref={asignacionRef}
                id="archivo-asignacion"
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                onChange={(e) => setArchivoAsignacion(e.target.files?.[0] ?? null)}
              />
              {archivoAsignacion ? (
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  {archivoAsignacion.name}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="archivo-nomina">Nómina LMS (CSV)</Label>
              <input
                ref={nominaRef}
                id="archivo-nomina"
                type="file"
                accept=".csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                onChange={(e) => setArchivoNomina(e.target.files?.[0] ?? null)}
              />
              {archivoNomina ? (
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  {archivoNomina.name}
                </p>
              ) : null}
            </div>

            {errorMsg ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            {successMsg ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                {successMsg}
              </div>
            ) : null}

            <Button
              type="button"
              disabled={loading || !archivoAsignacion || !archivoNomina}
              onClick={handleComparar}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {loading ? "Comparando…" : "Comparar y descargar"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
