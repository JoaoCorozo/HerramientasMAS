"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, RefreshCw, Trash2, Save, X } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Course = { moodle_id: number; shortname: string; fullname?: string }
type Profile = {
  id: number
  name: string
  name_key: string
  course_moodle_ids: number[]
  courses: Course[]
}

type MatrizPerfilRow = {
  id?: number
  hoja: string
  clave?: string
  cantidad_ids?: number
  cursos?: string[]
}

function profilesFromMatrizInfo(rows: MatrizPerfilRow[] | undefined): Profile[] {
  if (!rows?.length) return []
  return rows.map((p, idx) => ({
    id: p.id ?? idx + 1,
    name: p.hoja,
    name_key: p.clave ?? p.hoja,
    course_moodle_ids: [],
    courses: (p.cursos ?? []).map((shortname) => ({ moodle_id: 0, shortname })),
  }))
}

export function GeneradorProfileManager({
  matrizPerfiles,
  onMatrizChange,
}: {
  matrizPerfiles?: MatrizPerfilRow[]
  onMatrizChange?: () => void
}) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")
  const [loadError, setLoadError] = useState("")
  const [editing, setEditing] = useState<Profile | null>(null)
  const [formName, setFormName] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const loadCourses = useCallback(async (q: string = "") => {
    const cRes = await apiFetch("/api/generador/cursos?search=" + encodeURIComponent(q))
    if (cRes.ok) {
      const data = await cRes.json()
      setAllCourses(data.cursos || [])
    }
  }, [])

  const loadProfiles = useCallback(async () => {
    setLoadError("")
    const pRes = await apiFetch("/api/generador/perfiles")
    if (pRes.ok) {
      const data = await pRes.json()
      const list = data.perfiles || []
      if (list.length > 0) {
        setProfiles(list)
        return true
      }
    } else if (pRes.status === 404) {
      setLoadError(
        "El servidor no expone /api/generador/perfiles. Reinicie el backend (Iniciar_Web.bat) para cargar la versión actual."
      )
    } else if (!pRes.ok) {
      let detail = `Error ${pRes.status} al cargar perfiles`
      try {
        const err = await pRes.json()
        if (err.detail) detail = String(err.detail)
      } catch {
        /* ignore */
      }
      setLoadError(detail)
    }

    const fallback = profilesFromMatrizInfo(matrizPerfiles)
    if (fallback.length > 0) {
      setProfiles(fallback)
      if (!pRes.ok) {
        setLoadError(
          (prev) =>
            prev +
            " Mostrando resumen desde matriz-info; reinicie el backend para editar cursos."
        )
      }
      return false
    }
    return false
  }, [matrizPerfiles])

  const load = useCallback(async () => {
    setLoading(true)
    setMsg("")
    try {
      await Promise.all([loadProfiles(), loadCourses("")])
    } catch {
      setMsg("Error al cargar perfiles o catálogo")
    } finally {
      setLoading(false)
    }
  }, [loadProfiles, loadCourses])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (matrizPerfiles?.length && profiles.length === 0) {
      setProfiles(profilesFromMatrizInfo(matrizPerfiles))
    }
  }, [matrizPerfiles, profiles.length])

  useEffect(() => {
    if (editing) loadCourses(search)
  }, [search, editing, loadCourses])

  const startNew = () => {
    setEditing({ id: 0, name: "", name_key: "", course_moodle_ids: [], courses: [] })
    setFormName("")
    setSelectedIds(new Set())
    setLoadError("")
  }

  const startEdit = async (p: Profile) => {
    setLoading(true)
    try {
      const res = await apiFetch("/api/generador/perfiles")
      if (res.ok) {
        const data = await res.json()
        const full = (data.perfiles as Profile[] | undefined)?.find((x) => x.id === p.id)
        if (full) {
          setEditing(full)
          setFormName(full.name)
          setSelectedIds(new Set(full.course_moodle_ids))
          return
        }
      }
    } finally {
      setLoading(false)
    }
    setEditing(p)
    setFormName(p.name)
    setSelectedIds(new Set(p.course_moodle_ids))
  }

  const toggleCourse = (moodleId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(moodleId)) next.delete(moodleId)
      else next.add(moodleId)
      return next
    })
  }

  const save = async () => {
    if (!formName.trim()) {
      setMsg("Ingrese el nombre del perfil")
      return
    }
    const ids = Array.from(selectedIds)
    setLoading(true)
    try {
      if (editing && editing.id > 0) {
        const res = await apiFetch(`/api/generador/perfiles/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), course_moodle_ids: ids }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.detail || "Error al guardar")
        }
        setMsg("Perfil actualizado")
      } else {
        const res = await apiFetch("/api/generador/perfiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), course_moodle_ids: ids }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.detail || "Error al crear")
        }
        setMsg("Perfil creado")
      }
      setEditing(null)
      await loadProfiles()
      onMatrizChange?.()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm("¿Eliminar este perfil de inducción?")) return
    const res = await apiFetch(`/api/generador/perfiles/${id}`, { method: "DELETE" })
    if (res.ok) {
      setMsg("Perfil eliminado")
      await loadProfiles()
      onMatrizChange?.()
    } else {
      const e = await res.json().catch(() => ({}))
      setMsg(e.detail || "No se pudo eliminar")
    }
  }

  const syncCatalog = async () => {
    setLoading(true)
    const res = await apiFetch("/api/generador/sync-catalogo", { method: "POST" })
    if (res.ok) {
      const d = await res.json()
      setMsg(`Catálogo actualizado: ${d.importados} cursos`)
      await load()
      onMatrizChange?.()
    } else {
      const e = await res.json()
      setMsg(e.detail || "No se pudo sincronizar catálogo")
    }
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Perfiles de inducción</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Los cursos vienen del catálogo Moodle en base de datos. Defina qué cursos corresponden a cada
          perfil. El nombre debe coincidir con la columna PERFIL DE INDUCCIÓN de la dotación.
        </p>
      </div>

      {loadError && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          {loadError}
        </p>
      )}
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={startNew} className="gap-1">
          <Plus className="h-4 w-4" /> Nuevo perfil
        </Button>
        <Button size="sm" variant="secondary" onClick={() => load()} disabled={loading} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </Button>
        <Button size="sm" variant="outline" onClick={syncCatalog} disabled={loading}>
          Sincronizar catálogo desde Excel
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 max-h-80 overflow-y-auto border border-border rounded-lg p-3">
          {loading && profiles.length === 0 && (
            <p className="text-sm text-muted-foreground">Cargando perfiles…</p>
          )}
          {!loading && profiles.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay perfiles. Cree uno o reinicie el servidor para importar desde Excel.
            </p>
          )}
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.course_moodle_ids.length > 0
                    ? `${p.course_moodle_ids.length} cursos`
                    : p.courses.length > 0
                      ? `${p.courses.length} cursos (vista resumida)`
                      : "0 cursos"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {editing.id > 0 ? "Editar perfil" : "Nuevo perfil"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Label>Nombre del perfil (igual que en dotación)</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ej: VIGILANTE PRIVADO"
            />

            <div>
              <Label className="mb-2 block">Cursos asignados ({selectedIds.size})</Label>
              <Input
                placeholder="Buscar curso..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-2 bg-background">
                {allCourses.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    No se cargó el catálogo. Use Actualizar o Sincronizar catálogo.
                  </p>
                )}
                {allCourses.map((c) => (
                  <label
                    key={c.moodle_id}
                    className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/40 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.moodle_id)}
                      onChange={() => toggleCourse(c.moodle_id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-mono text-muted-foreground">{c.moodle_id}</span> — {c.shortname}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={loading} className="gap-1">
                <Save className="h-4 w-4" /> Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
