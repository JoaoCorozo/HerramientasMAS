"use client"

import { useState, useRef } from "react"
import { Play, Upload, FileSpreadsheet, Package, RefreshCw, AlertCircle } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function GeneradorPage() {
  const { token } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [grupo, setGrupo] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setErrorMsg("")
      setSuccessMsg("")
    }
  }

  const handleGenerar = async () => {
    if (!file) {
      setErrorMsg("Por favor, selecciona un archivo Excel de dotación.")
      return
    }
    if (!grupo.trim()) {
      setErrorMsg("Por favor, ingresa el nombre del grupo de inducción.")
      return
    }

    setLoading(true)
    setErrorMsg("")
    setSuccessMsg("")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("grupo", grupo)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/excel/generar-carga`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Fallo en el procesamiento de la carga.")
      }

      // Descargar el archivo ZIP retornado
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Scripts_Carga_Induccion_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setSuccessMsg("¡Procesamiento exitoso! Tu archivo ZIP con los CSVs por perfil se ha descargado.")
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Error inesperado al conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-8">
          
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Generador de Cargas e Inducciones
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Genera automáticamente planillas de carga CSV UTF-8 por perfil agrupadas y cruzadas con la matriz de cursos.
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-6">
            
            {/* Tarjeta de Configuración y Subida */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-medium text-card-foreground mb-6">Configuración del Proceso</h2>
              
              <div className="space-y-6">
                
                {/* 1. Nombre del Grupo */}
                <div className="grid gap-2">
                  <Label htmlFor="grupo" className="text-sm font-medium text-foreground">
                    Nombre del Grupo de Inducción
                  </Label>
                  <Input 
                    id="grupo"
                    placeholder="Ej: Grupo 14 de Mayo al 15 de Junio 2026"
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value)}
                    className="bg-input max-w-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este nombre se rellenará automáticamente en todas las columnas `group1`, `group2`, etc.
                  </p>
                </div>

                <hr className="border-border" />

                {/* 2. Drag & Drop o Selector */}
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-foreground">
                    Planilla de Dotación de Entrada (Excel)
                  </Label>
                  
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 text-center">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".xlsx,.xls" 
                      className="hidden" 
                    />
                    
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <FileSpreadsheet className="h-10 w-10 text-primary animate-pulse" />
                        <div>
                          <span className="text-sm font-medium text-foreground block">{file.name}</span>
                          <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Cambiar Archivo
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium text-foreground block">
                            Arrastra tu archivo aquí o haz clic en Explorar
                          </span>
                          <span className="text-xs text-muted-foreground block mt-1">
                            Soporta planillas .xlsx y .xls conteniendo la pestaña 'Formato enviar'
                          </span>
                        </div>
                        <Button 
                          variant="default" 
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2"
                        >
                          Explorar archivo...
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Mensajes de Alerta/Éxito */}
            {errorMsg && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3 animate-shake">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm text-primary flex items-center gap-3 animate-fade-in">
                <Package className="h-5 w-5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Botón de Acción Principal */}
            <div className="flex justify-center mt-4">
              <Button 
                size="lg" 
                className="w-full max-w-md h-12 text-base shadow-lg" 
                onClick={handleGenerar} 
                disabled={loading || !file || !grupo.trim()}
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Procesando y cruzando con Matriz...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Generar y Descargar CSVs (.zip)
                  </>
                )}
              </Button>
            </div>

          </div>

        </div>
      </main>
    </div>
  )
}
