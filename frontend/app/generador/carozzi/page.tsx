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
  coincidencias: number
  faltantes: number
  cliente: number
  plataforma: number
}

export default function CarozziComparadorPage() {
  useAuth()

  const [archivoCliente, setArchivoCliente] = useState<File | null>(null)
  const [archivoPlataforma, setArchivoPlataforma] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const clienteRef = useRef<HTMLInputElement>(null)
  const plataformaRef = useRef<HTMLInputElement>(null)

  const esClienteOk = (file: File) => /\.(xlsx|xls|csv)$/i.test(file.name)
  const esCsv = (file: File) => file.name.toLowerCase().endsWith(".csv")

  const handleComparar = async () => {
    if (!archivoCliente || !archivoPlataforma) {
      setErrorMsg("Selecciona el listado del cliente y la nómina de plataforma.")
      return
    }
    if (!esClienteOk(archivoCliente)) {
      setErrorMsg("El archivo del cliente debe ser Excel (.xlsx/.xls) o CSV.")
      return
    }
    if (!esCsv(archivoPlataforma)) {
      setErrorMsg("La nómina de plataforma debe ser CSV (.csv).")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const formData = new FormData()
      formData.append("archivo_cliente", archivoCliente)
      formData.append("archivo_plataforma", archivoPlataforma)

      const response = await apiFetch("/api/generador/carozzi/comparar", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          typeof err.detail === "string" ? err.detail : "Error al comparar DNI / C.I."
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
      let filename = "Reporte_Carozzi.xlsx"
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
          `Reporte generado: ${stats.coincidencias} coincidencias, ${stats.faltantes} faltantes ` +
            `(cliente ${stats.cliente} / plataforma ${stats.plataforma}).`
        )
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
            <h1 className="text-2xl font-semibold text-foreground">Comparar DNI / C.I.</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Compara el DNI del listado cliente (Excel o CSV) con el C.I. de la nómina
              plataforma (CSV). Ambos se normalizan a 8 dígitos con ceros a la izquierda.
              El Excel de salida tiene dos hojas: Coincidencias (datos de plataforma) y
              Faltantes (enviados por el cliente sin match).
            </p>
          </header>

          <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="archivo-cliente">1. Listado cliente (Excel / CSV)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => clienteRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivoCliente ? archivoCliente.name : "Ningún archivo seleccionado"}
                </span>
                <input
                  ref={clienteRef}
                  id="archivo-cliente"
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => setArchivoCliente(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="archivo-plataforma">2. Nómina plataforma (CSV)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => plataformaRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivoPlataforma ? archivoPlataforma.name : "Ningún archivo seleccionado"}
                </span>
                <input
                  ref={plataformaRef}
                  id="archivo-plataforma"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setArchivoPlataforma(e.target.files?.[0] ?? null)}
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
              disabled={loading || !archivoCliente || !archivoPlataforma}
              onClick={handleComparar}
            >
              <Play className="h-4 w-4" />
              {loading ? "Comparando…" : "Ejecutar comparación y descargar Excel"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
