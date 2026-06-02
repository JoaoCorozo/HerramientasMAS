"use client"

import { useState, useEffect } from "react"
import { Calendar as CalendarIcon, CheckCircle2, Circle, Plus, Trash2, ChevronLeft, ChevronRight, FileText, Mail, ClipboardPaste, Settings } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import {
  buildMailComposerUrl,
  recordatorioToMailPrefill,
  validateRecordatorioForMail,
} from "@/lib/mail-composer"
import { MailComposerLaunchDialog } from "@/components/mail-composer-launch-dialog"
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
  grupo_id?: string
  asunto: string
  cuerpo_mail: string
  ruta: string
  completada: boolean
  correo_notificacion?: string
  notificado?: boolean
}

interface RecordatorioImport extends Recordatorio {
  dateStr: string
}

type RecordatoriosDB = Record<string, Recordatorio[]>

export default function RecordatoriosPage() {
  const { user } = useAuth()
  const [db, setDb] = useState<RecordatoriosDB>({})
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [isOpen, setIsOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  
  // Estados para el Asistente de Importacion
  const [importQueue, setImportQueue] = useState<RecordatorioImport[]>([])
  const [currentImportIndex, setCurrentImportIndex] = useState(0)
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false)
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [rutaCopied, setRutaCopied] = useState<number | null>(null)
  
  // Formulario
  const [titulo, setTitulo] = useState("")
  const [detalle, setDetalle] = useState("")
  const [curso, setCurso] = useState("")
  const [grupo, setGrupo] = useState("")
  const [asunto, setAsunto] = useState("")
  const [cuerpoMail, setCuerpoMail] = useState("")
  const [grupoId, setGrupoId] = useState("")
  const [ruta, setRuta] = useState("")
  const [correoNotificacion, setCorreoNotificacion] = useState("")
  const [composerLaunchTask, setComposerLaunchTask] = useState<Recordatorio | null>(null)
  const [composerLaunchOpen, setComposerLaunchOpen] = useState(false)

  // Configuración SMTP
  const [smtpOpen, setSmtpOpen] = useState(false)
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPass, setSmtpPass] = useState("")
  const [smtpSenderName, setSmtpSenderName] = useState("")
  const [smtpSenderEmail, setSmtpSenderEmail] = useState("")

  const fetchSmtpConfig = async () => {
    try {
      if (!user) return
      const res = await apiFetch("/api/db/smtp_config")
      if (res.ok) {
        const data = await res.json()
        if (data && data.host) {
          setSmtpHost(data.host || "")
          setSmtpPort(data.port || "")
          setSmtpUser(data.username || "")
          setSmtpPass(data.password || "")
          setSmtpSenderName(data.sender_name || "")
          setSmtpSenderEmail(data.sender_email || "")
        }
      }
    } catch (e) {
      console.error("Error loading SMTP config:", e)
    }
  }

  const saveSmtpConfig = async () => {
    try {
      if (!user) return
      const res = await apiFetch("/api/db/smtp_config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          username: smtpUser,
          password: smtpPass,
          sender_name: smtpSenderName,
          sender_email: smtpSenderEmail
        })
      })
      if (res.ok) {
        alert("Configuración SMTP guardada exitosamente.")
        setSmtpOpen(false)
      } else {
        alert("Error al guardar la configuración SMTP.")
      }
    } catch (e) {
      console.error("Error saving SMTP config:", e)
      alert("Error de conexión al guardar configuración SMTP.")
    }
  }

  useEffect(() => {
    if (user) {
      fetchRecordatorios()
      fetchSmtpConfig()
    }
  }, [user])

  const fetchRecordatorios = async () => {
    try {
      if (!user) return
      const res = await apiFetch("/api/db/recordatorios", {
        cache: "no-store"
      })
      const data = await res.json()
      setDb(data || {})
    } catch (e) {
      console.error(e)
    }
  }

  const saveRecordatorios = async (newDb: RecordatoriosDB) => {
    try {
      if (!user) return
      const res = await apiFetch("/api/db/recordatorios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newDb),
      })
      
      if (!res.ok) {
        alert(`Ocurrió un error en el servidor al intentar guardar (Código: ${res.status}). Revisa la consola del terminal negro.`)
      }
      
      // Siempre forzamos a descargar la versión real del disco duro para evitar desincronizaciones
      await fetchRecordatorios()
    } catch (e) {
      console.error("Error de conexión:", e)
      alert("Error de conexión al guardar los datos.")
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
    setTitulo("")
    setDetalle("")
    setCurso("")
    setGrupo("")
    setGrupoId("")
    setAsunto("")
    setCuerpoMail("")
    setRuta("")
    setCorreoNotificacion("")
    setIsOpen(true)
  }

  const handleOpenEdit = (idx: number) => {
    const evt = currentEvents[idx]
    setEditingIndex(idx)
    setTitulo(evt.titulo || "")
    setDetalle(evt.detalle || "")
    setCurso(evt.curso || "")
    setGrupo(evt.grupo || "")
    setGrupoId(evt.grupo_id || "")
    setAsunto(evt.asunto || "")
    setCuerpoMail(evt.cuerpo_mail || evt.detalle || "")
    setRuta(evt.ruta || "")
    setCorreoNotificacion(evt.correo_notificacion || "")
    setIsOpen(true)
  }

  const buildRecordatorioFromForm = (): Recordatorio => ({
    titulo: titulo.trim(),
    detalle: detalle.trim(),
    curso: curso.trim(),
    grupo: grupo.trim(),
    grupo_id: grupoId.trim() || undefined,
    asunto: asunto.trim(),
    cuerpo_mail: cuerpoMail.trim(),
    ruta: ruta.trim(),
    completada: false,
    correo_notificacion: correoNotificacion.trim(),
    notificado: false,
  })

  const handleSave = () => {
    if (!titulo.trim()) return alert("El título es obligatorio")
    const draft = buildRecordatorioFromForm()
    const mailErr = validateRecordatorioForMail(draft)
    if (mailErr) return alert(mailErr)

    const nuevo: Recordatorio = { ...draft }
    
    const newDb = JSON.parse(JSON.stringify(db))
    if (!newDb[selectedDate]) newDb[selectedDate] = []
    
    if (editingIndex !== null) {
      nuevo.completada = newDb[selectedDate][editingIndex].completada
      const prev = newDb[selectedDate][editingIndex]
      nuevo.notificado = prev.correo_notificacion === correoNotificacion ? prev.notificado : false
      newDb[selectedDate][editingIndex] = nuevo
    } else {
      newDb[selectedDate].push(nuevo)
    }
    
    saveRecordatorios(newDb)
    setIsOpen(false)
  }

  const toggleStatus = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    // Uso Deep Clone para evitar problemas de re-render con mutación in-place
    const newDb = JSON.parse(JSON.stringify(db))
    newDb[selectedDate][idx].completada = !newDb[selectedDate][idx].completada
    saveRecordatorios(newDb)
  }

  const handleDelete = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("¿Eliminar este recordatorio?")) {
      const newDb = JSON.parse(JSON.stringify(db))
      newDb[selectedDate].splice(idx, 1)
      if (newDb[selectedDate].length === 0) delete newDb[selectedDate]
      saveRecordatorios(newDb)
    }
  }

  const handleCopiarRuta = async (ruta: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!ruta) return alert("No hay ruta definida")
    try {
      await navigator.clipboard.writeText(ruta)
      setRutaCopied(idx)
      setTimeout(() => setRutaCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
      alert("Error al copiar la ruta")
    }
  }

  const copyToClipboard = async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const openMailComposer = (evt: Recordatorio, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const mailErr = validateRecordatorioForMail(evt)
    if (mailErr) {
      alert(mailErr)
      return
    }
    const url = buildMailComposerUrl(recordatorioToMailPrefill(evt))
    const win = window.open(url, "_blank", "noopener,noreferrer")
    if (!win) {
      alert("El navegador bloqueó la ventana emergente. Permita ventanas emergentes para este sitio.")
    }
    setComposerLaunchTask(evt)
    setComposerLaunchOpen(true)
  }

  const handleImport = () => {
    if (!pasteText.trim()) return alert("Pega los datos del Excel primero")
    
    const mesesMap: Record<string, string> = {
      "enero": "01", "febrero": "02", "marzo": "03", "abril": "04", "mayo": "05", "junio": "06",
      "julio": "07", "agosto": "08", "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
    }

    const lineas = pasteText.split('\n').filter(l => l.trim())
    const queue: RecordatorioImport[] = []
    
    for (const linea of lineas) {
      const partes = linea.includes('\t') ? linea.split('\t') : linea.split(/\s{2,}/)
      
      if (partes.length >= 2) {
        const fechaRaw = partes[0].trim().toLowerCase()
        const tareaRaw = partes.slice(1).join(" ").trim()
        
        const regex = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/
        const match = fechaRaw.match(regex)
        
        if (match) {
          const dia = match[1].padStart(2, '0')
          const mes = mesesMap[match[2].replace('é', 'e').replace('í', 'i')] || "01"
          const anio = match[3]
          const dateStr = `${anio}-${mes}-${dia}`
          
          queue.push({
            dateStr,
            titulo: tareaRaw,
            detalle: "",
            curso: "",
            grupo: "",
            asunto: "",
            cuerpo_mail: "",
            ruta: "",
            completada: false,
            correo_notificacion: "",
            notificado: false
          })
        }
      }
    }
    
    if (queue.length > 0) {
      setImportQueue(queue)
      setCurrentImportIndex(0)
      setIsImportOpen(false)
      setIsImportWizardOpen(true)
    } else {
      alert("No se detectó ninguna fila válida. Asegúrate de copiar desde Excel con las columnas [Día] y [Tarea] (ej: martes, 5 de mayo de 2026).")
    }
  }

  const handleWizardNext = async (save: boolean) => {
    const current = importQueue[currentImportIndex]
    const newDb = JSON.parse(JSON.stringify(db))
    
    if (save) {
      const mailErr = validateRecordatorioForMail(current)
      if (mailErr) {
        alert(mailErr)
        return
      }
      if (!newDb[current.dateStr]) newDb[current.dateStr] = []
      newDb[current.dateStr].push({
        titulo: current.titulo,
        detalle: current.detalle,
        curso: current.curso,
        grupo: current.grupo,
        grupo_id: current.grupo_id,
        asunto: current.asunto,
        cuerpo_mail: current.cuerpo_mail || current.detalle || "",
        ruta: current.ruta,
        completada: current.completada,
        correo_notificacion: current.correo_notificacion || "",
        notificado: false
      })
      setDb(newDb) // Local state refresh early
    }

    if (currentImportIndex < importQueue.length - 1) {
      setCurrentImportIndex(prev => prev + 1)
    } else {
      await saveRecordatorios(newDb)
      setIsImportWizardOpen(false)
      setImportQueue([])
      setPasteText("")
    }
  }

  const handleUpdateCurrentImport = (field: keyof RecordatorioImport, value: string) => {
    const updatedQueue = [...importQueue]
    updatedQueue[currentImportIndex] = { ...updatedQueue[currentImportIndex], [field]: value }
    setImportQueue(updatedQueue)
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
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setSmtpOpen(true)} className="bg-purple-600 hover:bg-purple-700 px-2 animate-pulse" title="Configuración SMTP">
                <Settings className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => setIsImportOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 px-2" title="Pegar desde Excel">
                <ClipboardPaste className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600 px-2"
                title="Mail Composer (vacío)"
                onClick={() => window.open(buildMailComposerUrl(), "_blank", "noopener,noreferrer")}
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleOpenNew} className="bg-orange-600 hover:bg-orange-700 px-2" title="Nueva Tarea">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
                      {evt.asunto && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">Asunto: {evt.asunto}</p>
                      )}
                      {evt.correo_notificacion && (
                        <p className={`text-[11px] font-semibold mt-1 px-2 py-0.5 rounded-md w-max ${evt.notificado ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'}`}>
                          📧 {evt.correo_notificacion} {evt.notificado ? '✓ (Enviado)' : '(Pendiente 9:00 AM)'}
                        </p>
                      )}
                      {(evt.cuerpo_mail || evt.detalle) && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {evt.cuerpo_mail || evt.detalle}
                        </p>
                      )}
                    </div>
                  </div>

                  {!evt.completada && (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 w-full gap-2 bg-purple-600 hover:bg-purple-700"
                      onClick={(e) => openMailComposer(evt, e)}
                    >
                      <Mail className="h-4 w-4" />
                      Abrir Mail Composer (campos listos)
                    </Button>
                  )}
                  
                  <div className="flex flex-wrap justify-end gap-1 mt-2 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const title = encodeURIComponent(evt.titulo);
                        const details = encodeURIComponent(`${evt.cuerpo_mail || evt.detalle}\n\nCurso ID: ${evt.curso}\nGrupo: ${evt.grupo}\nAsunto: ${evt.asunto}\nRuta: ${evt.ruta}`);
                        const cleanDate = selectedDate.replace(/-/g, "");
                        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${cleanDate}/${cleanDate}&details=${details}`, "_blank");
                      }}
                      className="text-[11px] flex items-center gap-1 font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 px-2 py-1 rounded transition-colors"
                      title="Agregar a Google Calendar"
                    >
                      📅 Calendar
                    </button>
                    {evt.ruta && (
                      <button 
                        onClick={(e) => handleCopiarRuta(evt.ruta, idx, e)}
                        className="text-[11px] flex items-center gap-1 font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                        title="Copiar ruta"
                      >
                        {rutaCopied === idx ? "¡Copiado!" : "Copiar Ruta"}
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
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg p-3">
              Complete los datos del correo. El día de la tarea use el botón morado para abrir el Mail Composer con
              curso, grupo, asunto y cuerpo <strong>ya rellenados</strong>; usted revisa y envía manualmente.
            </p>

            <div className="grid gap-2">
              <Label>Título de la tarea *</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Correo de Bienvenida" />
            </div>

            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 space-y-4">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">Datos para Mail Composer *</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Curso (ID Moodle) *</Label>
                    <button type="button" onClick={() => copyToClipboard(curso)} className="text-xs text-blue-500 hover:underline">Copiar</button>
                  </div>
                  <Input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 44" required />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Grupo (nombre) *</Label>
                    <button type="button" onClick={() => copyToClipboard(grupo)} className="text-xs text-blue-500 hover:underline">Copiar</button>
                  </div>
                  <Input value={grupo} onChange={e => setGrupo(e.target.value)} placeholder="Ej: Grupo 05 de mayo..." required />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>ID de grupo Moodle (opcional)</Label>
                <Input value={grupoId} onChange={e => setGrupoId(e.target.value)} placeholder="Ej: 12345 — si lo conoce, selección más exacta" />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Asunto del correo *</Label>
                  <button type="button" onClick={() => copyToClipboard(asunto)} className="text-xs text-blue-500 hover:underline">Copiar</button>
                </div>
                <Input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Bienvenida a Inducción" required />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Cuerpo del correo *</Label>
                  <button type="button" onClick={() => copyToClipboard(cuerpoMail)} className="text-xs text-blue-500 hover:underline">Copiar</button>
                </div>
                <Textarea
                  value={cuerpoMail}
                  onChange={e => setCuerpoMail(e.target.value)}
                  className="min-h-[140px] font-mono text-sm"
                  placeholder="Texto del correo. Puede usar {{firstname}}, {{lastname}}, {{email}} si el composer lo soporta."
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Notas internas (opcional)</Label>
                <button type="button" onClick={() => copyToClipboard(detalle)} className="text-xs text-blue-500 hover:underline">Copiar</button>
              </div>
              <Textarea value={detalle} onChange={e => setDetalle(e.target.value)} className="min-h-[60px]" placeholder="Anotaciones que no se envían en el correo" />
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Ruta de Archivos (Local)</Label>
                <button onClick={() => copyToClipboard(ruta)} className="text-xs text-blue-500 hover:underline">Copiar</button>
              </div>
              <Input value={ruta} onChange={e => setRuta(e.target.value)} placeholder="G:/Unidades compartidas/..." />
            </div>

            <div className="grid gap-2 bg-purple-500/5 p-3 rounded-lg border border-purple-500/20">
              <Label className="text-purple-600 dark:text-purple-400 font-semibold">Correo de Notificación Programada (9:00 AM)</Label>
              <Input value={correoNotificacion} onChange={e => setCorreoNotificacion(e.target.value)} placeholder="ejemplo@bancoestado.cl" type="email" className="border-purple-500/30 focus:border-purple-500" />
              <span className="text-[10px] text-muted-foreground">Si ingresas un correo, el sistema le enviará un recordatorio automático el día de la tarea a las 9:00 AM.</span>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="border-purple-500/50 text-purple-600"
              onClick={() => openMailComposer(buildRecordatorioFromForm())}
            >
              <Mail className="h-4 w-4 mr-1" /> Probar Mail Composer
            </Button>
            <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">Guardar Tarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Importación Masiva desde Excel</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm text-muted-foreground mb-4 block">
              Copia las celdas desde tu archivo Excel y pégalas en la caja de abajo. <br/>
              La primera columna debe ser la <strong>Fecha</strong> (ej: "martes, 5 de mayo de 2026") y la segunda columna debe ser la <strong>Tarea</strong>.
            </Label>
            <Textarea 
              value={pasteText} 
              onChange={e => setPasteText(e.target.value)} 
              className="min-h-[200px] font-mono text-sm leading-relaxed whitespace-pre" 
              placeholder="martes, 5 de mayo de 2026&#9;Correo de Bienvenida&#10;jueves, 7 de mayo de 2026&#9;Recordatorio usuarios pendientes"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => handleImport()} className="bg-emerald-600 hover:bg-emerald-700">Comenzar Asistente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportWizardOpen} onOpenChange={(open) => {
        if (!open && confirm("¿Seguro que quieres cancelar el asistente? Las tareas que ya guardaste se conservarán.")) {
          setIsImportWizardOpen(false)
          setImportQueue([])
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Asistente de Importación ({currentImportIndex + 1} de {importQueue.length})</DialogTitle>
          </DialogHeader>
          {importQueue.length > 0 && importQueue[currentImportIndex] && (
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-md mb-2">
                <p className="text-sm font-medium text-orange-600 dark:text-orange-500 mb-1">Día asignado: {importQueue[currentImportIndex].dateStr}</p>
                <h3 className="font-semibold text-lg text-foreground">{importQueue[currentImportIndex].titulo}</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Curso (ID) *</Label>
                  <Input value={importQueue[currentImportIndex].curso} onChange={e => handleUpdateCurrentImport('curso', e.target.value)} placeholder="Ej: 44" />
                </div>
                <div className="grid gap-2">
                  <Label>Grupo *</Label>
                  <Input value={importQueue[currentImportIndex].grupo} onChange={e => handleUpdateCurrentImport('grupo', e.target.value)} placeholder="Ej: Grupo 05..." />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>ID de grupo (opcional)</Label>
                <Input value={importQueue[currentImportIndex].grupo_id || ""} onChange={e => handleUpdateCurrentImport('grupo_id', e.target.value)} placeholder="Ej: 12345" />
              </div>
              
              <div className="grid gap-2">
                <Label>Asunto del correo *</Label>
                <Input value={importQueue[currentImportIndex].asunto} onChange={e => handleUpdateCurrentImport('asunto', e.target.value)} placeholder="Ej: Bienvenida" />
              </div>
              
              <div className="grid gap-2">
                <Label>Cuerpo del correo *</Label>
                <Textarea value={importQueue[currentImportIndex].cuerpo_mail || ""} onChange={e => handleUpdateCurrentImport('cuerpo_mail', e.target.value)} className="min-h-[120px]" />
              </div>

              <div className="grid gap-2">
                <Label>Notas internas (opcional)</Label>
                <Textarea value={importQueue[currentImportIndex].detalle} onChange={e => handleUpdateCurrentImport('detalle', e.target.value)} className="min-h-[60px]" />
              </div>
              
              <div className="grid gap-2">
                <Label>Ruta de Archivos (Local)</Label>
                <Input value={importQueue[currentImportIndex].ruta} onChange={e => handleUpdateCurrentImport('ruta', e.target.value)} placeholder="G:/Unidades compartidas/..." />
              </div>

              <div className="grid gap-2 bg-purple-500/5 p-3 rounded-lg border border-purple-500/20">
                <Label className="text-purple-600 dark:text-purple-400 font-semibold">Correo de Notificación Programada (9:00 AM)</Label>
                <Input value={importQueue[currentImportIndex].correo_notificacion || ""} onChange={e => handleUpdateCurrentImport('correo_notificacion', e.target.value)} placeholder="ejemplo@bancoestado.cl" type="email" className="border-purple-500/30 focus:border-purple-500" />
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-row justify-between w-full items-center gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => handleWizardNext(false)} className="text-muted-foreground w-1/2">
              Omitir Tarea
            </Button>
            <Button onClick={() => handleWizardNext(true)} className="bg-emerald-600 hover:bg-emerald-700 w-1/2">
              Guardar y Siguiente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ajustes SMTP */}
      <Dialog open={smtpOpen} onOpenChange={setSmtpOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>⚙️ Ajustes de Notificaciones SMTP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Servidor SMTP (Host)</Label>
              <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com o smtp.office365.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Puerto</Label>
                <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" />
              </div>
              <div className="grid gap-2 flex items-end">
                <span className="text-xs text-muted-foreground pb-2">Normalmente 587 (TLS) o 465 (SSL)</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Usuario / Correo de Acceso</Label>
              <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="usuario@gmail.com" />
            </div>
            <div className="grid gap-2">
              <Label>Contraseña</Label>
              <Input value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="Contraseña de aplicación" type="password" />
            </div>
            <div className="grid gap-2">
              <Label>Nombre del Remitente</Label>
              <Input value={smtpSenderName} onChange={e => setSmtpSenderName(e.target.value)} placeholder="Plataforma de Herramientas BEX" />
            </div>
            <div className="grid gap-2">
              <Label>Correo del Remitente</Label>
              <Input value={smtpSenderEmail} onChange={e => setSmtpSenderEmail(e.target.value)} placeholder="remitente@correo.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmtpOpen(false)}>Cancelar</Button>
            <Button onClick={saveSmtpConfig} className="bg-purple-600 hover:bg-purple-700">Guardar Configuración</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MailComposerLaunchDialog
        open={composerLaunchOpen}
        onOpenChange={setComposerLaunchOpen}
        task={composerLaunchTask}
      />
    </div>
  )
}
