"use client"

import { useState, useEffect } from "react"
import { Link2, Plus, Trash2, Search, Edit2, ExternalLink } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

interface Enlace {
  title: string
  url: string
  empresa: string
  notes: string
  date?: string
}

export default function EnlacesPage() {
  const [enlaces, setEnlaces] = useState<Enlace[]>([])
  const [filtered, setFiltered] = useState<Enlace[]>([])
  const [search, setSearch] = useState("")
  const [empresaFilter, setEmpresaFilter] = useState("Todas")
  const [isOpen, setIsOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  
  // Form state
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    fetchEnlaces()
  }, [])

  useEffect(() => {
    let result = enlaces

    if (empresaFilter !== "Todas") {
      result = result.filter(e => e.empresa === empresaFilter)
    }

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(
        (e) =>
          (e.title || "").toLowerCase().includes(lower) ||
          (e.empresa || "").toLowerCase().includes(lower) ||
          (e.notes || "").toLowerCase().includes(lower)
      )
    }
    
    setFiltered(result)
  }, [search, empresaFilter, enlaces])

  const uniqueEmpresas = Array.from(new Set(enlaces.map(e => e.empresa).filter(Boolean)))

  const fetchEnlaces = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/db/enlaces")
      const data = await res.json()
      
      // Retrocompatibilidad (por si guardó "category" antes de este fix)
      const cleanedData = data.map((d: any) => ({
        ...d,
        empresa: d.empresa || d.category || ""
      }))
      
      setEnlaces(cleanedData || [])
    } catch (e) {
      console.error(e)
    }
  }

  const saveEnlaces = async (newData: Enlace[]) => {
    try {
      await fetch("http://127.0.0.1:8000/api/db/enlaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newData),
      })
      setEnlaces(newData)
    } catch (e) {
      console.error(e)
    }
  }

  const openNew = () => {
    setEditingIndex(null)
    setTitle("")
    setUrl("")
    setEmpresa("")
    setNotes("")
    setIsOpen(true)
  }

  const openEdit = (index: number) => {
    // Al filtrar, el índice original de "enlaces" no es el index del loop.
    // Buscamos el index real en el array principal
    const enlaceSeleccionado = filtered[index]
    const realIndex = enlaces.findIndex(e => e === enlaceSeleccionado)
    
    setEditingIndex(realIndex)
    setTitle(enlaceSeleccionado.title || "")
    setUrl(enlaceSeleccionado.url || "")
    // Se asegura que capture la categoria actual
    setEmpresa(enlaceSeleccionado.empresa || "")
    setNotes(enlaceSeleccionado.notes || "")
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (!title || !url) return alert("Título y URL son obligatorios")
    
    let validUrl = url
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = "https://" + validUrl
    }

    const nuevo: Enlace = {
      title,
      url: validUrl,
      empresa,
      notes,
      date: new Date().toLocaleString(),
    }
    
    const actualizados = [...enlaces]
    if (editingIndex !== null) {
      actualizados[editingIndex] = nuevo
    } else {
      actualizados.push(nuevo)
    }
    
    await saveEnlaces(actualizados)
    setIsOpen(false)
  }

  const handleDelete = async (index: number) => {
    if (confirm("¿Estás seguro de eliminar este enlace?")) {
      const enlaceSeleccionado = filtered[index]
      const realIndex = enlaces.findIndex(e => e === enlaceSeleccionado)
      const actualizados = enlaces.filter((_, i) => i !== realIndex)
      await saveEnlaces(actualizados)
    }
  }

  // Paleta de colores para categorias
  const colorPalettes = [
    "bg-blue-500/10 border-blue-500/30",
    "bg-emerald-500/10 border-emerald-500/30",
    "bg-purple-500/10 border-purple-500/30",
    "bg-amber-500/10 border-amber-500/30",
    "bg-pink-500/10 border-pink-500/30",
    "bg-indigo-500/10 border-indigo-500/30",
    "bg-cyan-500/10 border-cyan-500/30",
    "bg-rose-500/10 border-rose-500/30"
  ]

  const getEmpresaColor = (emp: string) => {
    if (!emp) return "bg-card border-border"
    // Generar un indice predecible basado en el string
    let hash = 0
    for (let i = 0; i < emp.length; i++) {
      hash = emp.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % colorPalettes.length
    return colorPalettes[index]
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Link2 className="h-5 w-5 text-blue-500" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Catálogo de Enlaces
              </h1>
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Enlace
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingIndex !== null ? "Editar Enlace" : "Añadir Nuevo Enlace"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="titulo">Título</Label>
                    <Input id="titulo" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Portal Interno HR" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="url">URL / Enlace</Label>
                    <Input id="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="empresa">Empresa / Categoría</Label>
                    <Input id="empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ej: Enaex" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notas">Notas (opcional)</Label>
                    <Textarea id="notas" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Apuntes adicionales..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Guardar Enlace</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </header>

          <div className="mb-8 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar enlaces..." 
                className="pl-10 w-full max-w-md bg-card"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div className="w-full sm:w-64">
              <select 
                className="w-full h-10 px-3 py-2 rounded-md border border-input bg-card text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={empresaFilter}
                onChange={e => setEmpresaFilter(e.target.value)}
              >
                <option value="Todas">Todas las categorías</option>
                {uniqueEmpresas.map((cat, i) => (
                  <option key={i} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {filtered.map((enlace, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border p-5 transition-all hover:shadow-md ${getEmpresaColor(enlace.empresa)}`}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg text-foreground truncate" title={enlace.title}>
                      {enlace.title || "Sin Título"}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1.5">
                    {enlace.empresa && (
                      <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-background/50 text-foreground/80 border border-border/50">
                        {enlace.empresa}
                      </span>
                    )}
                    {enlace.notes && (
                      <span className="text-sm text-muted-foreground truncate max-w-xs md:max-w-md">
                        • {enlace.notes}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 sm:mt-0 flex items-center justify-end gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1 mr-3 border-r border-border/40 pr-3">
                    <button 
                      onClick={() => openEdit(idx)}
                      className="p-2 text-muted-foreground hover:text-blue-500 hover:bg-background/50 rounded-md transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(idx)}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-background/50 rounded-md transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <a 
                    href={enlace.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors"
                  >
                    IR
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-card">
                No se encontraron enlaces en esta categoría.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
