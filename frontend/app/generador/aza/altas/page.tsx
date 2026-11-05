"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Play, Plus, Save, Settings2, Trash2 } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type MallaOpt = { tipousuario: string; malla: string }

type PersonaForm = {
  firstname: string
  lastname: string
  rut: string
  correo: string
  empresa: string
  malla: string
  tipousuario: string
}

/** Mismos valores por defecto que el backend (primer arranque). */
const DEFAULT_EMPRESAS = [
  "ACEROS AZA S.A.",
  "ACEROS COX COMERCIAL S.A.",
  "SALOMÓN SACK S.A.",
  "ARMACERO MATCO S.A.",
  "AZA",
  "EcoAZA",
]
const DEFAULT_MALLAS: MallaOpt[] = [
  { tipousuario: "1", malla: "AZA" },
  { tipousuario: "2", malla: "AZA Comercial" },
  { tipousuario: "3", malla: "Filiales" },
  { tipousuario: "4", malla: "Filiales Comercial" },
  { tipousuario: "5", malla: "Aza Lideres Operación / Ingenieros / Trainee" },
  { tipousuario: "6", malla: "EcoAZA" },
  { tipousuario: "7", malla: "Prof / Adm / Lideres Transversales AZA" },
]

const emptyPersona = (): PersonaForm => ({
  firstname: "",
  lastname: "",
  rut: "",
  correo: "",
  empresa: "",
  malla: "",
  tipousuario: "",
})

export default function AzaAltasPage() {
  useAuth()

  const [personas, setPersonas] = useState<PersonaForm[]>([emptyPersona()])
  const [mallas, setMallas] = useState<MallaOpt[]>(DEFAULT_MALLAS)
  const [empresas, setEmpresas] = useState<string[]>(DEFAULT_EMPRESAS)
  const [cfgEmpresas, setCfgEmpresas] = useState<string[]>(DEFAULT_EMPRESAS)
  const [cfgMallas, setCfgMallas] = useState<MallaOpt[]>(DEFAULT_MALLAS)
  const [loading, setLoading] = useState(false)
  const [savingCfg, setSavingCfg] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [preview, setPreview] = useState<Record<string, string> | null>(null)

  const applyCatalog = (data: { mallas?: MallaOpt[]; empresas?: string[]; empresas_sugeridas?: string[] }) => {
    const emps = data.empresas?.length ? data.empresas : data.empresas_sugeridas || []
    setMallas(data.mallas || [])
    setEmpresas(emps)
    setCfgEmpresas(emps)
    setCfgMallas(data.mallas || [])
  }

  const loadCatalogo = useCallback(async () => {
    const res = await apiFetch("/api/generador/aza/altas/catalogo")
    if (!res.ok) {
      setErrorMsg("No se pudo cargar el catálogo AZA.")
      return
    }
    applyCatalog(await res.json())
  }, [])

  useEffect(() => {
    loadCatalogo()
  }, [loadCatalogo])

  const updatePersona = (index: number, patch: Partial<PersonaForm>) => {
    setPersonas((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
    setPreview(null)
    setSuccessMsg("")
  }

  const onMallaChange = (index: number, mallaNombre: string) => {
    const hit = mallas.find((m) => m.malla === mallaNombre)
    updatePersona(index, {
      malla: mallaNombre,
      tipousuario: hit?.tipousuario || personas[index]?.tipousuario || "",
    })
  }

  const onTipoChange = (index: number, tipo: string) => {
    const hit = mallas.find((m) => m.tipousuario === tipo)
    updatePersona(index, {
      tipousuario: tipo,
      malla: hit?.malla || personas[index]?.malla || "",
    })
  }

  const handlePreview = async () => {
    const p = personas[0]
    if (!p) return
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch("/api/generador/aza/altas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || "No se pudo previsualizar.")
      }
      const data = await res.json()
      setPreview(data.fila || null)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al previsualizar.")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerar = async () => {
    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      for (let i = 0; i < personas.length; i++) {
        const p = personas[i]
        if (!p.firstname.trim() || !p.lastname.trim() || !p.rut.trim() || !p.correo.trim()) {
          throw new Error(`Fila ${i + 1}: completa nombre, apellido, RUT y correo.`)
        }
        if (!p.empresa.trim() || !p.malla.trim() || !p.tipousuario.trim()) {
          throw new Error(
            `Fila ${i + 1}: empresa, malla y tipo de usuario son obligatorios (relleno manual).`
          )
        }
      }

      const res = await apiFetch("/api/generador/aza/altas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personas }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(typeof d.detail === "string" ? d.detail : "Error al generar CSV.")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disp = res.headers.get("content-disposition")
      let name = "ALTAS_AZA.csv"
      if (disp?.includes("filename=")) {
        name = disp.split("filename=")[1].replace(/"/g, "").trim()
      }
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setSuccessMsg(`CSV descargado: ${name} (${personas.length} fila${personas.length > 1 ? "s" : ""}).`)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    setSavingCfg(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      const empresasClean = cfgEmpresas.map((e) => e.trim()).filter(Boolean)
      const mallasClean = cfgMallas
        .map((m) => ({
          tipousuario: m.tipousuario.trim(),
          malla: m.malla.trim(),
        }))
        .filter((m) => m.tipousuario && m.malla)

      const res = await apiFetch("/api/generador/aza/altas/catalogo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresas: empresasClean, mallas: mallasClean }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || "No se pudo guardar la configuración.")
      }
      const data = await res.json()
      applyCatalog(data)
      setSuccessMsg("Configuración AZA guardada.")
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al guardar.")
    } finally {
      setSavingCfg(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl min-w-0 px-8 py-8">
          <Link
            href="/generador/aza"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a procesos AZA
          </Link>

          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Generador de Cargas · AZA
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Altas de usuarios</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Genera el CSV de altas. Empresa, malla y tipousuario se eligen del catálogo configurable.
            </p>
          </header>

          <Tabs defaultValue="generar" className="space-y-6">
            <TabsList>
              <TabsTrigger value="generar">Generar altas</TabsTrigger>
              <TabsTrigger value="config" className="gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Configuración
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generar" className="space-y-6">
              {personas.map((p, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Persona {index + 1}</h2>
                    {personas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setPersonas((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nombre (firstname)</Label>
                      <Input
                        value={p.firstname}
                        onChange={(e) => updatePersona(index, { firstname: e.target.value })}
                        placeholder="Bastián"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellido (lastname)</Label>
                      <Input
                        value={p.lastname}
                        onChange={(e) => updatePersona(index, { lastname: e.target.value })}
                        placeholder="Ovalle Ortiz"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>RUT</Label>
                      <Input
                        value={p.rut}
                        onChange={(e) => updatePersona(index, { rut: e.target.value })}
                        placeholder="20536828-0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Correo</Label>
                      <Input
                        type="email"
                        value={p.correo}
                        onChange={(e) => updatePersona(index, { correo: e.target.value })}
                        placeholder="bastian.ovalle@aza.cl"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Relleno manual (desde catálogo)
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Empresa</Label>
                        <Input
                          list={`empresas-aza-${index}`}
                          value={p.empresa}
                          onChange={(e) => updatePersona(index, { empresa: e.target.value })}
                          placeholder="AZA"
                        />
                        <datalist id={`empresas-aza-${index}`}>
                          {empresas.map((e) => (
                            <option key={e} value={e} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label>Malla</Label>
                        <Input
                          list={`mallas-aza-${index}`}
                          value={p.malla}
                          onChange={(e) => onMallaChange(index, e.target.value)}
                          placeholder="Filiales"
                        />
                        <datalist id={`mallas-aza-${index}`}>
                          {mallas.map((m) => (
                            <option key={m.tipousuario} value={m.malla} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo usuario</Label>
                        <Input
                          list={`tipos-aza-${index}`}
                          value={p.tipousuario}
                          onChange={(e) => onTipoChange(index, e.target.value)}
                          placeholder="3"
                        />
                        <datalist id={`tipos-aza-${index}`}>
                          {mallas.map((m) => (
                            <option key={m.tipousuario} value={m.tipousuario}>
                              {m.malla}
                            </option>
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setPersonas((prev) => [...prev, emptyPersona()])}
              >
                <Plus className="h-4 w-4" />
                Agregar otra persona
              </Button>

              {preview && (
                <div className="overflow-x-auto rounded-lg border border-border bg-muted/20 p-4 text-xs">
                  <p className="mb-2 font-medium text-foreground">Vista previa (fila 1)</p>
                  <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                    {Object.entries(preview)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join("\n")}
                  </pre>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" disabled={loading} onClick={handlePreview}>
                  Previsualizar primera fila
                </Button>
                <Button type="button" className="gap-2" disabled={loading} onClick={handleGenerar}>
                  <Play className="h-4 w-4" />
                  {loading ? "Generando…" : "Generar y descargar CSV"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Empresas</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Nombres que aparecen al elegir empresa en el alta.
                </p>
                {cfgEmpresas.map((emp, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={emp}
                      onChange={(e) =>
                        setCfgEmpresas((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                      }
                      placeholder="Nombre empresa"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setCfgEmpresas((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={cfgEmpresas.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setCfgEmpresas((prev) => [...prev, ""])}
                >
                  <Plus className="h-4 w-4" />
                  Agregar empresa
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
                <h2 className="font-semibold text-foreground">Mallas y tipousuario</h2>
                <p className="text-sm text-muted-foreground">
                  Cada fila une el número de tipousuario con el nombre de malla (ej. 3 → Filiales).
                </p>
                <div className="grid grid-cols-[100px_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Tipo</span>
                  <span>Nombre malla</span>
                  <span />
                </div>
                {cfgMallas.map((m, i) => (
                  <div key={i} className="grid grid-cols-[100px_1fr_40px] gap-2">
                    <Input
                      value={m.tipousuario}
                      onChange={(e) =>
                        setCfgMallas((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, tipousuario: e.target.value } : x
                          )
                        )
                      }
                      placeholder="3"
                    />
                    <Input
                      value={m.malla}
                      onChange={(e) =>
                        setCfgMallas((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, malla: e.target.value } : x))
                        )
                      }
                      placeholder="Filiales"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setCfgMallas((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={cfgMallas.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setCfgMallas((prev) => [...prev, { tipousuario: "", malla: "" }])}
                >
                  <Plus className="h-4 w-4" />
                  Agregar malla
                </Button>
              </div>

              <Button type="button" className="gap-2" disabled={savingCfg} onClick={saveConfig}>
                <Save className="h-4 w-4" />
                {savingCfg ? "Guardando…" : "Guardar configuración"}
              </Button>
            </TabsContent>
          </Tabs>

          {errorMsg && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              {successMsg}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
