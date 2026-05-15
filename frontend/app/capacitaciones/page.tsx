"use client"

import { useState, useEffect } from "react"
import { BookOpen, Plus, Trash2, ExternalLink, Search, Clock, Calendar } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Capacitacion {
  title: string
  url: string
  duration: string
  notes: string
  date: string
}

export default function CapacitacionesPage() {
  const { token } = useAuth()
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([])
  const [filtered, setFiltered] = useState<Capacitacion[]>([])
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  
  // Form state
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [duration, setDuration] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")

  useEffect(() => {
    if (token) fetchCapacitaciones()
  }, [token])

  useEffect(() => {
    if (!search) {
      setFiltered(capacitaciones)
    } else {
      const lower = search.toLowerCase()
      setFiltered(
        capacitaciones.filter(
          (c) =>
            c.title.toLowerCase().includes(lower) ||
            c.notes.toLowerCase().includes(lower)
        )
      )
    }
  }, [search, capacitaciones])

  const fetchCapacitaciones = async () => {
    try {
      if (!token) return
      const res = await fetch("http://127.0.0.1:8000/api/db/capacitaciones", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setCapacitaciones(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const saveCapacitaciones = async (newData: Capacitacion[]) => {
    try {
      await fetch("http://127.0.0.1:8000/api/db/capacitaciones", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newData),
      })
      setCapacitaciones(newData)
    } catch (e) {
      console.error(e)
    }
  }

  const handleAdd = async () => {
    if (!title) return alert("El título es obligatorio")

    const nuevo: Capacitacion = {
      title,
      url,
      duration,
      notes,
      date: date || new Date().toISOString().split("T")[0],
    }
    
    const actualizados = [...capacitaciones, nuevo]
    await saveCapacitaciones(actualizados)
    
    setTitle("")
    setUrl("")
    setDuration("")
    setNotes("")
    setDate("")
    setIsOpen(false)
  }

  const handleDelete = async (index: number) => {
    if (confirm("¿Estás seguro de eliminar esta capacitación?")) {
      const actualizados = capacitaciones.filter((_, i) => i !== index)
      await saveCapacitaciones(actualizados)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                <BookOpen className="h-5 w-5 text-indigo-500" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Mis Capacitaciones
              </h1>
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="mr-2 h-4 w-4" /> Nueva Capacitación
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Añadir Capacitación</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Título</Label>
                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Onboarding 2026" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="url">Enlace / Video</Label>
                    <Input id="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="duration">Duración</Label>
                      <Input id="duration" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ej: 45 min" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="date">Fecha</Label>
                      <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Apuntes y Notas</Label>
                    <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Escribe tus notas aquí..." className="h-24" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </header>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar capacitaciones..." 
                className="pl-10 max-w-md bg-card"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[300px]">Título</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cap, index) => (
                  <TableRow key={index} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-indigo-500" />
                        </div>
                        {cap.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {cap.date.split(" ")[0] || "Sin fecha"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cap.duration ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {cap.duration}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-1 text-muted-foreground text-sm max-w-[200px]">
                        {cap.notes || "Sin notas"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {cap.url && (
                          <a 
                            href={cap.url.startsWith("http") ? cap.url : `https://${cap.url}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-secondary hover:bg-indigo-500/20 hover:text-indigo-500 transition-colors"
                            title="Abrir Enlace"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button 
                          onClick={() => handleDelete(index)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No se encontraron capacitaciones.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  )
}
