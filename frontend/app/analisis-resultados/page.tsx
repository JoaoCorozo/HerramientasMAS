"use client"

import { useRef, useState } from "react"
import { ChartColumn, Download, Play, Upload, AlertCircle } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface PreviewData {
  resumen: {
    intentos_emparejados: number
    preguntas_distintas_banco: number
    preguntas_por_intento: number
    aciertos_totales: number
    errores_totales: number
    pct_acierto_global: number | null
    nota_promedio: number | null
    nota_min: number | null
    nota_max: number | null
    pct_aprobacion_ge_60: number | null
    tiempo_promedio: string | null
    metodologia: string
    regla_puntaje: string
  }
  validacion: {
    ok: boolean
    total_duplicados?: number
    items_sin_evaluar?: number
    ordenes_incompletos?: number[]
  }
  metodologia: string
  total_preguntas: number
  total_detalle: number
  preview_preguntas_dificiles: {
    enunciado: string
    respuesta_correcta: string
    veces_presentada: number
    aciertos: number
    errores: number
    pct_acierto: number | null
    distractores_mas_elegidos: { respuesta: string; veces: number }[]
  }[]
  preview_nominativos: {
    rut?: string
    nombre_completo: string
    email: string
    comenzado?: string
    nota: number | null
    correctas: number
    incorrectas: number
    pct_acierto_intento: number | null
  }[]
  preview_detalle: {
    rut?: string
    nombre: string
    apellido: string
    email: string
    comenzado?: string
    orden: number
    enunciado: string
    respuesta_usuario: string
    respuesta_correcta: string
    resultado: string
  }[]
}

export default function AnalisisResultadosPage() {
  const { user } = useAuth()
  const respRef = useRef<HTMLInputElement>(null)
  const [fileResp, setFileResp] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  if (!user) return null

  const canAccess =
    user.role === "superadmin" || user.permissions.includes("analisis_resultados")

  if (!canAccess) {
    return (
      <div className="flex h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-8">
          <p className="text-red-500">No tienes permiso para este módulo.</p>
        </main>
      </div>
    )
  }

  const buildForm = () => {
    if (!fileResp) throw new Error("Selecciona el Excel de respuestas.")
    const fd = new FormData()
    fd.append("respuestas", fileResp)
    return fd
  }

  const handlePreview = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch("/api/analisis-resultados/preview", {
        method: "POST",
        body: buildForm(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "No se pudo analizar.")
      }
      setPreview(await res.json())
    } catch (e: unknown) {
      setPreview(null)
      setErrorMsg(e instanceof Error ? e.message : "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const handleExcel = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch("/api/analisis-resultados/excel", {
        method: "POST",
        body: buildForm(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "No se pudo generar el Excel.")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disp = res.headers.get("content-disposition")
      let name = "Analisis_Resultados_Evaluacion.xlsx"
      if (disp?.includes("filename=")) {
        name = disp.split("filename=")[1].replace(/"/g, "").trim()
      }
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const r = preview?.resumen
  const v = preview?.validacion

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ChartColumn className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Análisis de Resultados</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Un informe de respuestas del LMS. El Excel completo incluye la hoja{" "}
                  <span className="font-medium text-foreground">Detalle_respuestas</span> (una fila
                  por usuario × pregunta).
                </p>
              </div>
            </div>
          </header>

          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-10 text-center hover:bg-muted/20"
            onClick={() => respRef.current?.click()}
          >
            <input
              ref={respRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                setFileResp(e.target.files?.[0] ?? null)
                setPreview(null)
              }}
            />
            <Upload className="mb-3 h-8 w-8 text-primary/80" />
            <Label className="font-semibold">Informe de respuestas</Label>
            <span className="mt-1 text-xs text-muted-foreground">
              {fileResp ? fileResp.name : "…-respuestas.xlsx"}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handlePreview} disabled={loading || !fileResp} className="gap-2">
              <Play className="h-4 w-4" />
              Previsualizar
            </Button>
            <Button
              variant="secondary"
              onClick={handleExcel}
              disabled={loading || !fileResp}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar Excel
            </Button>
          </div>

          {errorMsg && (
            <div className="mt-4 flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {errorMsg}
            </div>
          )}

          {preview && r && (
            <div className="mt-8 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Intentos", r.intentos_emparejados],
                  ["Preguntas distintas", r.preguntas_distintas_banco],
                  ["% acierto global", r.pct_acierto_global],
                  ["Nota promedio", r.nota_promedio],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Aciertos/errores:{" "}
                <span className="text-foreground font-medium">
                  {r.aciertos_totales} / {r.errores_totales}
                </span>
                {" · "}
                Aprobación ≥60:{" "}
                <span className="text-foreground font-medium">{r.pct_aprobacion_ge_60}%</span>
                {" · "}
                Filas de detalle en Excel:{" "}
                <span className="text-foreground font-medium">{preview.total_detalle}</span>
                {" · "}
                Hojas: Resumen, Por_pregunta, Por_usuario, Detalle_respuestas
              </div>

              {v && !v.ok && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p className="font-semibold">Validación: revisar</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {(v.total_duplicados ?? 0) > 0 && (
                      <li>Filas duplicadas (correo + inicio): {v.total_duplicados}</li>
                    )}
                    {(v.items_sin_evaluar ?? 0) > 0 && (
                      <li>Ítems sin evaluar: {v.items_sin_evaluar}</li>
                    )}
                    {(v.ordenes_incompletos?.length ?? 0) > 0 && (
                      <li>Órdenes incompletos: {v.ordenes_incompletos?.join(", ")}</li>
                    )}
                  </ul>
                </div>
              )}

              <section className="rounded-xl border border-border overflow-hidden">
                <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold">
                  Preguntas más difíciles
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2">Enunciado</th>
                        <th className="p-2">% acierto</th>
                        <th className="p-2">Bien/Total</th>
                        <th className="p-2">Errores frecuentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview_preguntas_dificiles.map((p) => (
                        <tr key={p.enunciado} className="border-t border-border/50 align-top">
                          <td className="p-2 max-w-[320px]">{p.enunciado}</td>
                          <td className="p-2 whitespace-nowrap">{p.pct_acierto ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">
                            {p.aciertos}/{p.veces_presentada}
                          </td>
                          <td className="p-2 max-w-[220px] text-muted-foreground">
                            {p.distractores_mas_elegidos
                              .slice(0, 3)
                              .map((d) => `${d.respuesta} (${d.veces})`)
                              .join(" · ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-border overflow-hidden">
                  <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold">
                    Por usuario (muestra)
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="p-2">Usuario</th>
                          <th className="p-2">Nota</th>
                          <th className="p-2">Bien/Mal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview_nominativos.map((it, idx) => (
                          <tr
                            key={`${it.email}|${it.comenzado ?? ""}|${idx}`}
                            className="border-t border-border/50"
                          >
                            <td className="p-2">
                              <div>{it.nombre_completo}</div>
                              <div className="text-muted-foreground">
                                {[it.rut, it.email].filter(Boolean).join(" · ")}
                              </div>
                            </td>
                            <td className="p-2">{it.nota}</td>
                            <td className="p-2">
                              {it.correctas}/{it.incorrectas}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-border overflow-hidden">
                  <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold">
                    Detalle respuestas (muestra) — completo en Excel
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="p-2">Usuario</th>
                          <th className="p-2">Pregunta</th>
                          <th className="p-2">Respondió</th>
                          <th className="p-2">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview_detalle.map((d, i) => (
                          <tr
                            key={`${d.email}|${d.comenzado ?? ""}|${d.orden}|${i}`}
                            className="border-t border-border/50 align-top"
                          >
                            <td className="p-2">
                              <div className="whitespace-nowrap">
                                {d.nombre} {d.apellido}
                              </div>
                              <div className="text-muted-foreground">
                                {[d.rut, d.email].filter(Boolean).join(" · ")}
                              </div>
                            </td>
                            <td className="p-2 max-w-[160px]">{d.enunciado}</td>
                            <td className="p-2 max-w-[120px]">{d.respuesta_usuario || "—"}</td>
                            <td className="p-2 whitespace-nowrap">{d.resultado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}

          {loading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="rounded-lg border border-border bg-card px-6 py-4 text-sm">Procesando…</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
