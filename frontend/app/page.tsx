"use client"

import { useState } from "react"
import { Zap } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { FileUploadCard } from "@/components/file-upload-card"
import { ResultsPanel } from "@/components/results-panel"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export default function Home() {
  const { token } = useAuth()
  const [reportType, setReportType] = useState("diferencias")
  
  // Archivo 1
  const [file1, setFile1] = useState<File | null>(null)
  const [cIni1, setCIni1] = useState("A")
  const [cFin1, setCFin1] = useState("")
  const [fIni1, setFIni1] = useState("2")
  const [fFin1, setFFin1] = useState("")
  const [hoja1, setHoja1] = useState("Activa (Por defecto)")

  // Archivo 2
  const [file2, setFile2] = useState<File | null>(null)
  const [cIni2, setCIni2] = useState("A")
  const [cFin2, setCFin2] = useState("")
  const [fIni2, setFIni2] = useState("2")
  const [fFin2, setFFin2] = useState("")
  const [hoja2, setHoja2] = useState("Activa (Por defecto)")

  const [status, setStatus] = useState<"waiting" | "processing" | "success" | "error">("waiting")
  const [errorMsg, setErrorMsg] = useState("")

  const handleComenzar = async () => {
    if (!file1 || !file2) {
      alert("Falta seleccionar los archivos.")
      return
    }
    
    setStatus("processing")
    setErrorMsg("")
    
    try {
      const formData = new FormData()
      formData.append("file1", file1)
      formData.append("file2", file2)
      formData.append("tipo_reporte", reportType)
      formData.append("c_ini1", cIni1)
      formData.append("f_ini1", fIni1)
      formData.append("hoja1", hoja1)
      formData.append("c_ini2", cIni2)
      formData.append("f_ini2", fIni2)
      formData.append("hoja2", hoja2)
      // Agregamos finales solo si existen
      if (cFin1) formData.append("c_fin1", cFin1)
      if (fFin1) formData.append("f_fin1", fFin1)
      if (cFin2) formData.append("c_fin2", cFin2)
      if (fFin2) formData.append("f_fin2", fFin2)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/comparador`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || "Error al procesar el Excel")
      }
      
      const blob = await response.blob()
      
      // Descargar el archivo devuelto
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = response.headers.get("content-disposition")
      let filename = "Reporte.xlsx"
      if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, "")
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      
      setStatus("success")
    } catch (error: any) {
      console.error(error)
      setErrorMsg(error.message)
      setStatus("error")
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Analizador y Comparador de Bases de Datos
              </h1>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <FileUploadCard 
              title="Archivo Principal (Base)" 
              file={file1} setFile={setFile1}
              c_ini={cIni1} setC_ini={setCIni1}
              c_fin={cFin1} setC_fin={setCFin1}
              f_ini={fIni1} setF_ini={setFIni1}
              f_fin={fFin1} setF_fin={setFFin1}
              hoja={hoja1} setHoja={setHoja1}
            />
            <FileUploadCard 
              title="Archivo de Contraste" 
              file={file2} setFile={setFile2}
              c_ini={cIni2} setC_ini={setCIni2}
              c_fin={cFin2} setC_fin={setCFin2}
              f_ini={fIni2} setF_ini={setFIni2}
              f_fin={fFin2} setF_fin={setFFin2}
              hoja={hoja2} setHoja={setHoja2}
            />
          </div>

          <div className="mt-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm font-medium text-foreground">Tipo de Reporte a Generar</span>
              <ToggleGroup
                type="single"
                value={reportType}
                onValueChange={(value) => value && setReportType(value)}
                className="bg-muted rounded-lg p-1"
              >
                <ToggleGroupItem
                  value="diferencias"
                  className="rounded-md px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Solo Diferencias
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="coincidencias"
                  className="rounded-md px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Solo Coincidencias
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="ambos"
                  className="rounded-md px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Ambos (2 Hojas)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Button size="lg" className="w-full max-w-md" onClick={handleComenzar} disabled={status === "processing"}>
              <Zap className="mr-2 h-4 w-4" />
              {status === "processing" ? "Procesando en Python..." : "Comenzar comparación"}
            </Button>
          </div>

          <div className="mt-8">
            <ResultsPanel status={status} />
            {status === "error" && <p className="text-red-500 text-center mt-4">{errorMsg}</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
