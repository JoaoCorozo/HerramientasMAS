"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface ParseResult {
  email: string
  nombre_completo: string
  rut: string
  firstname: string
  lastname: string
  campos_extra?: Record<string, string>
  email_es_transelec?: boolean
}

export default function TranselecAltasPage() {
  useAuth()

  const [texto, setTexto] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [email, setEmail] = useState("")
  const [nombreCompleto, setNombreCompleto] = useState("")
  const [rut, setRut] = useState("")
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [grupo, setGrupo] = useState("")
  const [cursos, setCursos] = useState<string[]>([])
  const [grupos, setGrupos] = useState<string[]>([])
  const [nuevoCurso, setNuevoCurso] = useState("")
  const [nuevoGrupo, setNuevoGrupo] = useState("")
  const [selectedCursos, setSelectedCursos] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const loadConfig = useCallback(async () => {
    const res = await apiFetch("/api/generador/transelec/config")
    if (res.ok) {
      const data = await res.json()
      setCursos(data.cursos || [])
      setGrupos(data.grupos || [])
      if (data.grupos?.length && !grupo) setGrupo(data.grupos[0])
    }
  }, [grupo])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const applyParsed = (data: ParseResult) => {
    setParsed(data)
    setEmail(data.email || "")
    setNombreCompleto(data.nombre_completo || "")
    setRut(data.rut || "")
    setFirstname(data.firstname || "")
    setLastname(data.lastname || "")
    if (!data.email_es_transelec && data.email) {
      setErrorMsg("El correo detectado no es @transelec.cl. Puedes generar igual con confirmación.")
    } else {
      setErrorMsg("")
    }
  }

  const handleParseTexto = async () => {
    if (!texto.trim()) {
      setErrorMsg("Pega el texto de la solicitud.")
      return
    }
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await apiFetch("/api/generador/transelec/altas/parse-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || "No se pudo extraer la información.")
      }
      applyParsed(await res.json())
      setSuccessMsg("Datos extraídos del texto.")
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al extraer.")
    } finally {
      setLoading(false)
    }
  }

  const handleParseArchivo = async () => {
    if (!file) {
      setErrorMsg("Selecciona un archivo.")
      return
    }
    setLoading(true)
    setErrorMsg("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await apiFetch("/api/generador/transelec/altas/parse-archivo", {
        method: "POST",
        body: fd,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || "No se pudo leer el archivo.")
      }
      applyParsed(await res.json())
      setSuccessMsg("Datos extraídos del archivo.")
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al leer archivo.")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerar = async (forzarEmail = false) => {
    if (!rut.trim() || !firstname.trim()) {
      setErrorMsg("RUT y firstname son obligatorios.")
      return
    }
    if (!email.trim()) {
      setErrorMsg("Correo obligatorio.")
      return
    }
    if (!grupo.trim()) {
      setErrorMsg("Selecciona un grupo.")
      return
    }
    if (!email.endsWith("@transelec.cl") && !forzarEmail) {
      const ok = window.confirm(
        "El correo no es @transelec.cl y puede no funcionar en la plataforma. ¿Generar de todas formas?"
      )
      if (!ok) return
      return handleGenerar(true)
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      const res = await apiFetch("/api/generador/transelec/altas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          rut,
          firstname,
          lastname,
          grupo,
          forzar_email_no_transelec: forzarEmail,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        const msg = d.detail || "Error al generar."
        if (typeof msg === "string" && msg.includes("@transelec.cl") && !forzarEmail) {
          return handleGenerar(true)
        }
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disp = res.headers.get("content-disposition")
      let name = "Script_altas.csv"
      if (disp?.includes("filename=")) {
        name = disp.split("filename=")[1].replace(/"/g, "").trim()
      }
      a.download = name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      setSuccessMsg(`CSV generado con ${cursos.length} cursos.`)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al generar.")
    } finally {
      setLoading(false)
    }
  }

  const agregarCurso = async () => {
    const nombre = nuevoCurso.trim()
    if (!nombre) return
    const res = await apiFetch("/api/generador/transelec/cursos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    })
    if (res.ok) {
      const data = await res.json()
      setCursos(data.cursos)
      setNuevoCurso("")
    }
  }

  const eliminarCursos = async () => {
    if (!selectedCursos.length) return
    const nombres = selectedCursos.map((i) => cursos[i])
    if (!window.confirm(`¿Eliminar ${nombres.length} curso(s)?`)) return
    const res = await apiFetch("/api/generador/transelec/cursos/eliminar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombres }),
    })
    if (res.ok) {
      const data = await res.json()
      setCursos(data.cursos)
      setSelectedCursos([])
    }
  }

  const agregarGrupo = async () => {
    const nombre = nuevoGrupo.trim()
    if (!nombre) return
    const res = await apiFetch("/api/generador/transelec/grupos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    })
    if (res.ok) {
      const data = await res.json()
      setGrupos(data.grupos)
      setGrupo(nombre)
      setNuevoGrupo("")
    }
  }

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
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Transelec
                </p>
                <h1 className="text-2xl font-semibold text-foreground">Altas de usuarios nuevos</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Extrae datos de solicitudes por texto o archivo. Incluye todos los cursos del catálogo.
                </p>
              </div>
            </div>
          </header>

          <Tabs defaultValue="texto" className="space-y-6">
            <TabsList>
              <TabsTrigger value="texto">Pegar solicitud</TabsTrigger>
              <TabsTrigger value="archivo">Subir archivo</TabsTrigger>
              <TabsTrigger value="catalogo">Cursos y grupos</TabsTrigger>
            </TabsList>

            <TabsContent value="texto" className="rounded-xl border border-border bg-card p-6">
              <Label htmlFor="solicitud">Texto de la solicitud (correo, ticket, etc.)</Label>
              <Textarea
                id="solicitud"
                className="mt-2 min-h-[220px] font-mono text-sm"
                placeholder="Pega aquí el contenido con Nombre, Rut, correo @transelec.cl..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <Button className="mt-4" onClick={handleParseTexto} disabled={loading}>
                Extraer datos
              </Button>
            </TabsContent>

            <TabsContent value="archivo" className="rounded-xl border border-border bg-card p-6">
              <div
                className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border p-8 hover:bg-muted/20"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Upload className="h-10 w-10 text-primary/80 mb-2" />
                <span className="text-sm font-medium">{file?.name || "CSV o Excel del cliente"}</span>
              </div>
              <Button className="mt-4" onClick={handleParseArchivo} disabled={loading}>
                Leer archivo y extraer
              </Button>
            </TabsContent>

            <TabsContent value="catalogo" className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Catálogo de cursos ({cursos.length})</h2>
                </div>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Nombre exacto del curso en LMS"
                    value={nuevoCurso}
                    onChange={(e) => setNuevoCurso(e.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={agregarCurso}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={eliminarCursos}
                    disabled={!selectedCursos.length}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="max-h-48 overflow-auto rounded-lg border border-border p-2 text-sm">
                  {cursos.map((c, i) => (
                    <label key={c} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCursos.includes(i)}
                        onChange={(e) => {
                          setSelectedCursos((prev) =>
                            e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)
                          )
                        }}
                      />
                      <span className="truncate">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold mb-4">Grupos</h2>
                <div className="flex gap-2 mb-4">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value)}
                  >
                    {grupos.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nuevo grupo"
                    value={nuevoGrupo}
                    onChange={(e) => setNuevoGrupo(e.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={agregarGrupo}>
                    Agregar grupo
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {(parsed || email || rut) && (
            <div className="mt-6 rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-medium">Datos para la carga</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Correo</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>RUT</Label>
                  <Input value={rut} onChange={(e) => setRut(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Nombre completo (detectado)</Label>
                  <Input value={nombreCompleto} readOnly className="bg-muted/30" />
                </div>
                <div>
                  <Label>Firstname</Label>
                  <Input value={firstname} onChange={(e) => setFirstname(e.target.value)} />
                </div>
                <div>
                  <Label>Lastname</Label>
                  <Input value={lastname} onChange={(e) => setLastname(e.target.value)} />
                </div>
                <div>
                  <Label>Grupo</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value)}
                  >
                    {grupos.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {parsed?.campos_extra && Object.keys(parsed.campos_extra).length > 0 && (
                <div className="rounded-lg bg-muted/30 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-2">Campos adicionales detectados</p>
                  <ul className="space-y-1">
                    {Object.entries(parsed.campos_extra).map(([k, v]) => (
                      <li key={k}>
                        <strong>{k}:</strong> {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={() => handleGenerar()} disabled={loading} className="gap-2">
                <Play className="h-4 w-4" />
                Generar CSV de alta ({cursos.length} cursos)
              </Button>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
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
