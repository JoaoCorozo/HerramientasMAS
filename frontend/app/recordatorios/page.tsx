"use client"

import { useState, useEffect } from "react"
import { Calendar as CalendarIcon, CheckCircle2, Circle, Plus, Trash2, ChevronLeft, ChevronRight, FileText } from "lucide-react"
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
  DialogFooter,
} from "@/components/ui/dialog"

interface Recordatorio {
  titulo: string
  detalle: string
  curso: string
  grupo: string
  asunto: string
  ruta: string
  completada: boolean
}

type RecordatoriosDB = Record<string, Recordatorio[]>

export default function RecordatoriosPage() {
  const { token } = useAuth()
  const [db, setDb] = useState<RecordatoriosDB>({})
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [isOpen, setIsOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  
  // Formulario
  const [titulo, setTitulo] = useState("")
  const [detalle, setDetalle] = useState("")
  const [curso, setCurso] = useState("")
  const [grupo, setGrupo] = useState("")
  const [asunto, setAsunto] = useState("")
  const [ruta, setRuta] = useState("")

  useEffect(() => {
    if (token) fetchRecordatorios()
  }, [token])

  const fetchRecordatorios = async () => {
    try {
      if (!token) return
      const res = await fetch("http://127.0.0.1:8000/api/db/recordatorios", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setDb(data || {})
    } catch (e) {
      console.error(e)
    }
  }

  const saveRecordatorios = async (newDb: RecordatoriosDB) => {
    try {
      await fetch("http://127.0.0.1:8000/api/db/recordatorios", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newDb),
      })
      setDb(newDb)
    } catch (e) {
      console.error(e)
    }
  }

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleDayClick = (day: number) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    // Ajuste de timezone
    const offset = d.getTimezoneOffset()
    const finalDate = new Date(d.getTime() - (offset*60*1000))
    setSelectedDate(finalDate.toISOString().split("T")[0])
  }

  const renderCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    
    // Ajustar para que Lunes sea el primer dia (0 = Domingo en JS)
    const startingDay = firstDay === 0 ? 6 : firstDay - 1
    
    const days = []
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-transparent"></div>)
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset()*60*1000)).toISOString().split("T")[0]
      const hasEvents = db[dateStr] && db[dateStr].length > 0
      const isSelected = dateStr === selectedDate
      const isToday = dateStr === new Date().toISOString().split("T")[0]
      
      let pendingCount = 0
      if (hasEvents) {
        pendingCount = db[dateStr].filter(e => !e.completada).length
      }

      const totalCount = hasEvents ? db[dateStr].length : 0
      const completedCount = totalCount - pendingCount

      let bgClass = "bg-card"
      let borderClass = "border-border"
      
      if (hasEvents) {
        if (pendingCount > 0) {
          bgClass = "bg-orange-500/10 hover:bg-orange-500/20"
          borderClass = "border-orange-500/30"
        } else {
          bgClass = "bg-green-500/10 hover:bg-green-500/20"
          borderClass = "border-green-500/30"
        }
      } else {
        bgClass = "bg-card hover:bg-muted/50"
      }

      if (isSelected) {
        borderClass = hasEvents ? (pendingCount > 0 ? "border-orange-500 ring-2 ring-orange-500/20" : "border-green-500 ring-2 ring-green-500/20") : "border-primary ring-2 ring-primary/20"
      }

      days.push(
        <div 
          key={day} 
          onClick={() => handleDayClick(day)}
          className={`p-2 border cursor-pointer transition-all relative flex flex-col justify-between min-h-[60px] ${bgClass} ${borderClass} ${isToday ? 'font-bold' : ''}`}
        >
          <div className="flex justify-between items-start">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm
              ${isToday ? 'bg-primary text-primary-foreground' : ''}
            `}>
              {day}
            </span>
          </div>

          {hasEvents && (
            <div className="flex flex-col gap-0.5 mt-2">
              {completedCount > 0 && (
                <div className="text-[10px] font-semibold text-green-600 dark:text-green-500 bg-green-500/10 rounded px-1 w-full text-center truncate">
                  {completedCount} Lista{completedCount > 1 ? 's' : ''}
                </div>
              )}
              {pendingCount > 0 && (
                <div className="text-[10px] font-semibold text-orange-600 dark:text-orange-500 bg-orange-500/10 rounded px-1 w-full text-center truncate">
                  {pendingCount} Pdt{pendingCount > 1 ? 's' : ''}.
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
    
    return days
  }

  const currentEvents = db[selectedDate] || []

  const handleOpenNew = () => {
    setEditingIndex(null)
    setTitulo(""); setDetalle(""); setCurso(""); setGrupo(""); setAsunto(""); setRuta("")
    setIsOpen(true)
  }

  const handleOpenEdit = (idx: number) => {
    const evt = currentEvents[idx]
    setEditingIndex(idx)
    setTitulo(evt.titulo || "")
    setDetalle(evt.detalle || "")
    setCurso(evt.curso || "")
    setGrupo(evt.grupo || "")
    setAsunto(evt.asunto || "")
    setRuta(evt.ruta || "")
    setIsOpen(true)
  }

  const handleSave = () => {
    if (!titulo) return alert("El título es obligatorio")
    
    const nuevo: Recordatorio = {
      titulo, detalle, curso, grupo, asunto, ruta, completada: false
    }
    
    const newDb = { ...db }
    if (!newDb[selectedDate]) newDb[selectedDate] = []
    
    if (editingIndex !== null) {
      // Keep completion status
      nuevo.completada = newDb[selectedDate][editingIndex].completada
      newDb[selectedDate][editingIndex] = nuevo
    } else {
      newDb[selectedDate].push(nuevo)
    }
    
    saveRecordatorios(newDb)
    setIsOpen(false)
  }

  const toggleStatus = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newDb = { ...db }
    newDb[selectedDate][idx].completada = !newDb[selectedDate][idx].completada
    saveRecordatorios(newDb)
  }

  const handleDelete = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("¿Eliminar este recordatorio?")) {
      const newDb = { ...db }
      newDb[selectedDate].splice(idx, 1)
      if (newDb[selectedDate].length === 0) delete newDb[selectedDate]
      saveRecordatorios(newDb)
    }
  }

  const handleAbrirRuta = async (ruta: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!ruta) return alert("No hay ruta definida")
    try {
      await fetch("http://127.0.0.1:8000/api/abrir-ruta", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ruta })
      })
    } catch (err) {
      console.error(err)
    }
  }

  const copyToClipboard = async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      // Visual feedback podria agregarse aqui
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto flex flex-col lg:flex-row">
        {/* Calendario */}
        <div className="flex-1 p-8 border-r border-border flex flex-col h-full overflow-hidden">
          <header className="mb-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <CalendarIcon className="h-5 w-5 text-orange-500" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Calendario de Tareas
              </h1>
            </div>
            
            <div className="flex items-center gap-4 bg-muted/50 rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="w-32 text-center font-medium">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col flex-1">
            <div className="grid grid-cols-7 border-b border-border bg-muted/50 flex-shrink-0">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                <div key={d} className="p-3 text-center text-sm font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
              {renderCalendar()}
            </div>
          </div>
        </div>

        {/* Panel Lateral de Eventos */}
        <div className="w-full lg:w-96 bg-muted/20 p-8 flex flex-col h-full overflow-auto">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-500" />
              {selectedDate}
            </h2>
            <Button size="sm" onClick={handleOpenNew} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            {currentEvents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center border-2 border-dashed border-border rounded-xl p-6">
                <CalendarIcon className="h-10 w-10 mb-2 opacity-20" />
                <p>No hay tareas para este día.</p>
              </div>
            ) : (
              currentEvents.map((evt, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleOpenEdit(idx)}
                  className={`p-4 rounded-xl border cursor-pointer ${evt.completada ? 'bg-card/50 border-border opacity-70' : 'bg-card border-orange-500/30 hover:border-orange-500/50'} shadow-sm relative group transition-colors`}
                >
                  <div className="flex items-start gap-3 pr-6">
                    <button onClick={(e) => toggleStatus(idx, e)} className="mt-1 flex-shrink-0 text-muted-foreground hover:text-orange-500 transition-colors">
                      {evt.completada ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold ${evt.completada ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {evt.titulo}
                      </h3>
                      {evt.curso && <p className="text-xs font-medium text-orange-500 mt-1">Curso ID: {evt.curso}</p>}
                      {evt.grupo && <p className="text-xs text-muted-foreground mt-1 truncate">{evt.grupo}</p>}
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{evt.detalle}</p>
                    </div>
                  </div>
                  
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    {evt.ruta && (
                      <button 
                        onClick={(e) => handleAbrirRuta(evt.ruta, e)}
                        className="text-xs flex items-center gap-1 font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                        title="Abrir ubicación en Windows"
                      >
                        Abrir Ruta
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={(e) => handleDelete(idx, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-red-500 transition-all bg-card/80 rounded-md"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Detalles / Editar Tarea" : `Nueva Tarea (${selectedDate})`}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Correo de Bienvenida" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Curso (ID)</Label>
                  <button onClick={() => copyToClipboard(curso)} className="text-xs text-blue-500 hover:underline">Copiar</button>
                </div>
                <Input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 44" />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Grupo</Label>
                  <button onClick={() => copyToClipboard(grupo)} className="text-xs text-blue-500 hover:underline">Copiar</button>
                </div>
                <Input value={grupo} onChange={e => setGrupo(e.target.value)} placeholder="Ej: Grupo 05 de May..." />
              </div>
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Asunto del Correo</Label>
                <button onClick={() => copyToClipboard(asunto)} className="text-xs text-blue-500 hover:underline">Copiar</button>
              </div>
              <Input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Bienvenida a Inducción" />
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Detalle / Descripción</Label>
                <button onClick={() => copyToClipboard(detalle)} className="text-xs text-blue-500 hover:underline">Copiar</button>
              </div>
              <Textarea value={detalle} onChange={e => setDetalle(e.target.value)} className="min-h-[80px]" />
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Ruta de Archivos (Local)</Label>
                <button onClick={() => copyToClipboard(ruta)} className="text-xs text-blue-500 hover:underline">Copiar</button>
              </div>
              <Input value={ruta} onChange={e => setRuta(e.target.value)} placeholder="G:/Unidades compartidas/..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">Guardar Tarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
