"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, FileSpreadsheet, Play } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ReportStats {
  corregidos?: number
  consultar?: number
  mapeos?: number
  cliente?: number
  corregida?: number
  pendientes?: number
}

interface PendingItem {
  id: string
  fila: number
  columna: string
  error_analizador: string
  motivo: string
  cliente: { rut: string; nombre: string; apellido: string; valor: string }
  corregida: { rut: string; nombre: string; apellido: string; valor: string }
}

type DecisionDestino = "corregidos" | "consultar"

export default function EminComparadorPage() {
  useAuth()

  const [archivoCliente, setArchivoCliente] = useState<File | null>(null)
  const [archivoCorregida, setArchivoCorregida] = useState<File | null>(null)
  const [archivoAnalizador, setArchivoAnalizador] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const [pending, setPending] = useState<PendingItem[]>([])
  const [pendingIndex, setPendingIndex] = useState(0)
  const [decisiones, setDecisiones] = useState<Record<string, DecisionDestino>>({})
  const [modalOpen, setModalOpen] = useState(false)

  const clienteRef = useRef<HTMLInputElement>(null)
  const corregidaRef = useRef<HTMLInputElement>(null)
  const analizadorRef = useRef<HTMLInputElement>(null)

  const esPlanilla = (file: File) => /\.(xlsx|xls|csv)$/i.test(file.name)

  const descargarBlob = async (response: Response, stats: ReportStats | null) => {
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const contentDisposition = response.headers.get("content-disposition")
    let filename = "Reporte_EMIN.xlsx"
    if (contentDisposition?.includes("filename=")) {
      filename = contentDisposition.split("filename=")[1].replace(/"/g, "")
    }
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)

    if (stats?.corregidos != null) {
      setSuccessMsg(
        `Reporte generado: ${stats.corregidos} corregidos, ${stats.consultar} consultar a cliente, ` +
          `${stats.mapeos} valores únicos en mapeo (cliente ${stats.cliente} / corregida ${stats.corregida}).`
      )
    } else {
      setSuccessMsg("Reporte Excel descargado correctamente.")
    }
  }

  const ejecutarComparacion = async (decisionesMap: Record<string, DecisionDestino>) => {
    if (!archivoCliente || !archivoCorregida) {
      setErrorMsg("Selecciona la nómina cliente y la nómina corregida.")
      return
    }
    if (!esPlanilla(archivoCliente) || !esPlanilla(archivoCorregida)) {
      setErrorMsg("Nóminas deben ser Excel (.xlsx/.xls) o CSV.")
      return
    }
    if (archivoAnalizador && !esPlanilla(archivoAnalizador)) {
      setErrorMsg("El analizador debe ser Excel (.xlsx/.xls) o CSV.")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const formData = new FormData()
      formData.append("archivo_cliente", archivoCliente)
      formData.append("archivo_corregida", archivoCorregida)
      if (archivoAnalizador) {
        formData.append("archivo_analizador", archivoAnalizador)
      }
      if (Object.keys(decisionesMap).length > 0) {
        formData.append(
          "decisiones",
          JSON.stringify(
            Object.entries(decisionesMap).map(([id, destino]) => ({ id, destino }))
          )
        )
      }

      const response = await apiFetch("/api/generador/emin/comparar", {
        method: "POST",
        body: formData,
      })

      const contentType = response.headers.get("content-type") || ""

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          typeof err.detail === "string" ? err.detail : "Error al comparar nóminas EMIN."
        )
      }

      if (contentType.includes("application/json")) {
        const data = await response.json()
        if (data.status === "needs_review" && Array.isArray(data.pending) && data.pending.length) {
          setPending(data.pending as PendingItem[])
          setPendingIndex(0)
          setDecisiones(decisionesMap)
          setModalOpen(true)
          setSuccessMsg(
            `${data.pending.length} hallazgo(s) del analizador requieren tu decisión.`
          )
          return
        }
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

      setModalOpen(false)
      setPending([])
      setPendingIndex(0)
      setDecisiones({})
      await descargarBlob(response, stats)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const handleComparar = () => {
    void ejecutarComparacion({})
  }

  const handleDecision = (destino: DecisionDestino) => {
    const actual = pending[pendingIndex]
    if (!actual) return
    const nextDecisiones = { ...decisiones, [actual.id]: destino }
    setDecisiones(nextDecisiones)

    if (pendingIndex + 1 < pending.length) {
      setPendingIndex(pendingIndex + 1)
      return
    }

    // Todas resueltas → regenerar con decisiones
    setModalOpen(false)
    void ejecutarComparacion(nextDecisiones)
  }

  const actual = pending[pendingIndex]

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
            <h1 className="text-2xl font-semibold text-foreground">Comparar nóminas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Compara nómina cliente vs corregida. Opcionalmente sube el Excel del analizador
              (Fila / Columna / Error): si coincide con un error del comparador se usa ese texto;
              si no, decides en un modal si va a Corregidos o Consultar a Cliente.
            </p>
          </header>

          <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="archivo-cliente">1. Nómina cliente (Excel / CSV)</Label>
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
              <Label htmlFor="archivo-corregida">2. Nómina corregida (Excel / CSV)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => corregidaRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivoCorregida ? archivoCorregida.name : "Ningún archivo seleccionado"}
                </span>
                <input
                  ref={corregidaRef}
                  id="archivo-corregida"
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => setArchivoCorregida(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="archivo-analizador">
                3. Analizador plataforma (opcional · Fila / Columna / Error)
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => analizadorRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivoAnalizador ? archivoAnalizador.name : "Ningún archivo seleccionado"}
                </span>
                <input
                  ref={analizadorRef}
                  id="archivo-analizador"
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => setArchivoAnalizador(e.target.files?.[0] ?? null)}
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
              disabled={loading || !archivoCliente || !archivoCorregida}
              onClick={handleComparar}
            >
              <Play className="h-4 w-4" />
              {loading ? "Comparando…" : "Ejecutar comparación y descargar Excel"}
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={!loading}>
          <DialogHeader>
            <DialogTitle>
              Decisión analizador ({pendingIndex + 1} de {pending.length})
            </DialogTitle>
            <DialogDescription>
              Este hallazgo no lo marcó el comparador. Elige destino para la fila.
            </DialogDescription>
          </DialogHeader>

          {actual && (
            <div className="space-y-4 text-sm">
              <p className="text-foreground">{actual.motivo}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 font-medium">Nómina cliente</p>
                  <dl className="space-y-1 text-muted-foreground">
                    <div>
                      <span className="text-foreground">RUT:</span> {actual.cliente.rut || "—"}
                    </div>
                    <div>
                      <span className="text-foreground">Nombre:</span>{" "}
                      {actual.cliente.nombre || "—"}
                    </div>
                    <div>
                      <span className="text-foreground">Apellido:</span>{" "}
                      {actual.cliente.apellido || "—"}
                    </div>
                    <div>
                      <span className="text-foreground">{actual.columna}:</span>{" "}
                      {actual.cliente.valor || "—"}
                    </div>
                  </dl>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 font-medium">Nómina corregida</p>
                  <dl className="space-y-1 text-muted-foreground">
                    <div>
                      <span className="text-foreground">RUT:</span> {actual.corregida.rut || "—"}
                    </div>
                    <div>
                      <span className="text-foreground">Nombre:</span>{" "}
                      {actual.corregida.nombre || "—"}
                    </div>
                    <div>
                      <span className="text-foreground">Apellido:</span>{" "}
                      {actual.corregida.apellido || "—"}
                    </div>
                    <div>
                      <span className="text-foreground">{actual.columna}:</span>{" "}
                      {actual.corregida.valor || "—"}
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <p className="font-medium text-foreground">Error analizador · {actual.columna}</p>
                <p className="mt-1 text-muted-foreground">{actual.error_analizador}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => handleDecision("corregidos")}
            >
              Enviar a Corregidos
            </Button>
            <Button type="button" disabled={loading} onClick={() => handleDecision("consultar")}>
              Enviar a Consultar a Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
