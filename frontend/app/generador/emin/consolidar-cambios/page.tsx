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
  antigua: number
  nueva: number
  consolidada: number
  actualizados: number
  nuevos: number
  solo_antigua: number
}

export default function EminConsolidarCambiosPage() {
  useAuth()

  const [archivoAntigua, setArchivoAntigua] = useState<File | null>(null)
  const [archivoNueva, setArchivoNueva] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const antiguaRef = useRef<HTMLInputElement>(null)
  const nuevaRef = useRef<HTMLInputElement>(null)

  const esPlanilla = (file: File) => /\.(xlsx|xls|csv)$/i.test(file.name)

  const handleConsolidar = async () => {
    if (!archivoAntigua || !archivoNueva) {
      setErrorMsg("Selecciona la nómina antigua y la nómina nueva.")
      return
    }
    if (!esPlanilla(archivoAntigua) || !esPlanilla(archivoNueva)) {
      setErrorMsg("Ambos archivos deben ser Excel (.xlsx/.xls) o CSV.")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const formData = new FormData()
      formData.append("archivo_antigua", archivoAntigua)
      formData.append("archivo_nueva", archivoNueva)

      const response = await apiFetch("/api/generador/emin/consolidar-cambios", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          typeof err.detail === "string" ? err.detail : "Error al consolidar cambios del cliente."
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
      let filename = "EMIN_Consolidar_cambios_cliente.xlsx"
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
          `Consolidada: ${stats.consolidada} usuarios ` +
            `(antigua ${stats.antigua} + ${stats.nuevos} altas; ` +
            `${stats.actualizados} actualizados, ${stats.solo_antigua} solo antigua).`
        )
      } else {
        setSuccessMsg("Excel consolidado descargado correctamente.")
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
              Generador de Cargas · EMIN
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Consolidar cambios cliente</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Une la nómina antigua con la nueva por RUT. La primera hoja queda como nómina
              consolidada (todos los antiguos + altas nuevas). En coincidencias se conservan RUT,
              nombre y apellido de la antigua y se actualiza el resto desde la nueva. Las hojas
              Actualizados y Nuevos sirven para auditoría.
            </p>
          </header>

          <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="archivo-antigua">1. Nómina antigua (base previa)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => antiguaRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivoAntigua ? archivoAntigua.name : "Ningún archivo seleccionado"}
                </span>
                <input
                  ref={antiguaRef}
                  id="archivo-antigua"
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => setArchivoAntigua(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="archivo-nueva">2. Nómina nueva (versión actualizada)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => nuevaRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivoNueva ? archivoNueva.name : "Ningún archivo seleccionado"}
                </span>
                <input
                  ref={nuevaRef}
                  id="archivo-nueva"
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => setArchivoNueva(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

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
              disabled={loading || !archivoAntigua || !archivoNueva}
              onClick={() => void handleConsolidar()}
            >
              <Play className="h-4 w-4" />
              {loading ? "Consolidando…" : "Consolidar y descargar Excel"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
