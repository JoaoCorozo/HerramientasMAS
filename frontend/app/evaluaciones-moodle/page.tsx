"use client"

import { useRef, useState } from "react"
import { ClipboardList, FileDown, Eraser, Wand2, Bold, Upload, ListOrdered } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  convertirOpcionMultiple,
  downloadBlob,
  downloadTextFile,
  marcarAlternativaCorrectaDocx,
  ordenarTextoEvaluacion,
} from "@/lib/evaluaciones-moodle"

export default function EvaluacionesMoodlePage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [textosEliminados, setTextosEliminados] = useState<string[]>([])

  if (!user) return null

  const canAccess =
    user.role === "superadmin" || user.permissions.includes("evaluaciones_moodle")

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

  const handleCargarDocx = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const blob = await marcarAlternativaCorrectaDocx(file)
      downloadBlob(blob, "Evaluacion_Modificada.docx")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el archivo .docx")
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleOrdenar = () => {
    setError("")
    const result = ordenarTextoEvaluacion(texto)
    setTexto(result.texto)
    if (result.textosEliminados.length > 0) {
      setTextosEliminados(result.textosEliminados)
      setModalOpen(true)
    }
  }

  const handleConvertir = (conNegrita: boolean) => {
    setError("")
    if (!texto.trim()) {
      setError("Pega o carga el texto de la evaluación antes de convertir.")
      return
    }
    const convertido = convertirOpcionMultiple(texto, conNegrita)
    downloadTextFile(convertido, "evaluacion_moodle.txt")
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-foreground">Evaluaciones Moodle</h1>
            <p className="text-sm text-muted-foreground">
              Ordena, marca alternativas correctas y convierte preguntas al formato GIFT
            </p>
          </div>
          <a
            href="/evaluaciones-moodle/assets/documentos/Manual_de_Uso.pdf"
            download="manual_de_uso.pdf"
            className="text-sm font-medium text-primary hover:underline"
          >
            Descargar Manual de Uso
          </a>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Preguntas de opción múltiple
            </h2>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pega tu evaluación aquí"
              className="min-h-[420px] font-mono text-sm leading-relaxed"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleCargarDocx(e.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {busy ? "Procesando…" : "Cargar Evaluación"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleOrdenar} className="gap-2">
              <ListOrdered className="h-4 w-4" />
              Ordenar texto
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleConvertir(false)}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Convertir
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleConvertir(true)}
              className="gap-2"
            >
              <Bold className="h-4 w-4" />
              Convertir en Negrita
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTexto("")
                setError("")
              }}
              className="gap-2"
            >
              <Eraser className="h-4 w-4" />
              Borrar Contenido
            </Button>
            <Button type="button" variant="ghost" className="gap-2 pointer-events-none opacity-70">
              <FileDown className="h-4 w-4" />
              Salida: .txt / .docx
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Textos eliminados</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
              {textosEliminados.map((item) => (
                <li key={item}>{item.replace(/^\d+-\s*/, "")}</li>
              ))}
            </ol>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
