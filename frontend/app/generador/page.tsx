"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Upload, FileSpreadsheet, Package, RefreshCw, AlertCircle, ArrowLeft, ArrowRight, Check, Eye, HelpCircle } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const STANDARD_COLUMNS = [
  "username", "institution", "password", "middlename", "department", "address", "aim", 
  "phone1", "firstname", "phone2", "alternatename", "msn", "description", "company", 
  "lastname", "role", "yahoo", "email", "suspended", "auth", "skype", "icq", 
  "country", "city", "firstnamephonetic", "lastnamephonetic"
]

const RECOMMENDED_COLUMNS = [
  "username", "password", "firstname", "lastname", "email", "department", "address", "auth", "suspended"
]

interface MappingConfig {
  type: "column" | "fixed"
  value: string
}

interface PreviewProfile {
  profile_name: string
  headers: string[]
  rows: string[][]
}

export default function GeneradorPage() {
  const { token } = useAuth()
  const [step, setStep] = useState(1)
  
  // File state
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  
  // Inspection state
  const [sheetsData, setSheetsData] = useState<Record<string, string[]>>({})
  const [selectedSheet, setSelectedSheet] = useState("")
  
  // Selected output columns
  const [selectedCols, setSelectedCols] = useState<string[]>(RECOMMENDED_COLUMNS)
  
  // Mapping configuration
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>({})
  const [grupo, setGrupo] = useState("")
  
  // Preview state
  const [previews, setPreviews] = useState<Record<string, PreviewProfile>>({})
  const [activePreviewTab, setActivePreviewTab] = useState("")
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // LocalStorage mapping persistence
  useEffect(() => {
    const saved = localStorage.getItem("generador_mappings")
    const savedGrupo = localStorage.getItem("generador_grupo")
    if (saved) {
      try {
        setMappings(JSON.parse(saved))
      } catch (e) {
        console.error("Error loading saved mappings", e)
      }
    }
    if (savedGrupo) {
      setGrupo(savedGrupo)
    }
  }, [])

  const saveMappingsToLocal = (currentMappings: Record<string, MappingConfig>, currentGrupo: string) => {
    localStorage.setItem("generador_mappings", JSON.stringify(currentMappings))
    localStorage.setItem("generador_grupo", currentGrupo)
  }

  // Handle file upload and immediate inspection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      setErrorMsg("")
      setSuccessMsg("")
      
      setLoading(true)
      try {
        const formData = new FormData()
        formData.append("file", selectedFile)
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/excel/inspect`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        })
        
        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.detail || "Error al inspeccionar el archivo.")
        }
        
        const data = await response.json()
        setSheetsData(data.sheets)
        
        // Auto-select first sheet
        const firstSheet = Object.keys(data.sheets)[0] || ""
        setSelectedSheet(firstSheet)
        if (firstSheet) {
          autoConfigureMapping(firstSheet, data.sheets[firstSheet])
        }
        
        setStep(2)
      } catch (err: any) {
        console.error(err)
        setErrorMsg(err.message || "Error al conectar con el servidor para inspeccionar el Excel.")
        setFile(null)
      } finally {
        setLoading(false)
      }
    }
  }

  // Auto configure mapping using fuzzy logic
  const autoConfigureMapping = (sheetName: string, headers: string[]) => {
    const findMatch = (patterns: string[]) => {
      return headers.find(h => {
        const upper = h.toUpperCase()
        return patterns.some(p => upper.includes(p))
      }) || ""
    }
    
    const runHeader = findMatch(["RUN", "RUT", "IDENTIFICADOR", "CEDULA", "DNI"])
    const nameHeader = findMatch(["NOMBRE", "FIRSTNAME", "COLABORADOR", "COMPLETO"])
    const emailHeader = findMatch(["CORREO", "EMAIL", "MAIL", "CONTACTO"])
    const perfilHeader = findMatch(["PERFIL", "DEPARTAMENTO", "DEPARTMENT", "INDUCCI", "CARGO"])
    
    const newMappings: Record<string, MappingConfig> = {}
    
    STANDARD_COLUMNS.forEach(col => {
      if (mappings[col] && mappings[col].value !== "") {
        newMappings[col] = mappings[col]
        return
      }
      
      if (col === "auth") {
        newMappings[col] = { type: "fixed", value: "saml2" }
      } else if (col === "suspended") {
        newMappings[col] = { type: "fixed", value: "0" }
      } else if (col === "username" || col === "password" || col === "address") {
        newMappings[col] = { type: "column", value: runHeader }
      } else if (col === "firstname" || col === "lastname") {
        newMappings[col] = { type: "column", value: nameHeader }
      } else if (col === "email") {
        newMappings[col] = { type: "column", value: emailHeader }
      } else if (col === "department") {
        newMappings[col] = { type: "column", value: perfilHeader }
      } else {
        newMappings[col] = { type: "column", value: "" }
      }
    })
    
    setMappings(newMappings)
  }

  // Update sheet selection and reset headers mappings
  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet)
    autoConfigureMapping(sheet, sheetsData[sheet] || [])
  }

  const toggleColumnSelection = (col: string) => {
    if (selectedCols.includes(col)) {
      setSelectedCols(selectedCols.filter(c => c !== col))
    } else {
      setSelectedCols([...selectedCols, col])
    }
  }

  const selectRecommendedColumns = () => {
    setSelectedCols(RECOMMENDED_COLUMNS)
  }

  const handleMappingChange = (col: string, field: "type" | "value", val: string) => {
    const updated = {
      ...mappings,
      [col]: {
        ...mappings[col],
        [field]: val
      }
    }
    setMappings(updated)
    saveMappingsToLocal(updated, grupo)
  }

  const handleGrupoChange = (val: string) => {
    setGrupo(val)
    saveMappingsToLocal(mappings, val)
  }

  // Generate mapping payload containing only the selected columns
  const getSelectedMappingPayload = () => {
    const payload: Record<string, MappingConfig> = {}
    selectedCols.forEach(col => {
      payload[col] = mappings[col] || { type: "column", value: "" }
    })
    return payload
  }

  // Request Preview from Backend (First 10 Rows)
  const handleGetPreview = async () => {
    if (!file) return
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
      formData.append("sheet_name", selectedSheet)
      formData.append("grupo", grupo)
      formData.append("mapping", JSON.stringify(getSelectedMappingPayload()))

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/excel/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Fallo al generar previsualización.")
      }

      const data = await response.json()
      setPreviews(data.previews)
      
      const firstTab = Object.keys(data.previews)[0] || ""
      setActivePreviewTab(firstTab)
      
      setStep(4)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Error inesperado al conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }

  // Download complete Zip
  const handleDownloadZip = async () => {
    if (!file) return
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
      formData.append("sheet_name", selectedSheet)
      formData.append("grupo", grupo)
      formData.append("mapping", JSON.stringify(getSelectedMappingPayload()))

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

  const currentSheetHeaders = sheetsData[selectedSheet] || []

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Generador de Cargas e Inducciones Pro
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Crea planillas CSV UTF-8 por perfil con mapeos a medida, previsualización en tiempo real y cruce de matriz de cursos.
                </p>
              </div>
            </div>
          </header>

          {/* Indicador de Pasos / Wizard Progress */}
          <div className="mb-8 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm">
            <div className="flex justify-between items-center max-w-xl mx-auto">
              {[
                { s: 1, label: "Subir Excel" },
                { s: 2, label: "Columnas" },
                { s: 3, label: "Mapear" },
                { s: 4, label: "Previsualizar" }
              ].map((stepInfo, idx) => (
                <div key={stepInfo.s} className="flex items-center">
                  <button
                    onClick={() => {
                      if (file && stepInfo.s < step) {
                        setStep(stepInfo.s)
                        setErrorMsg("")
                      }
                    }}
                    disabled={!file || stepInfo.s > step}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                      step === stepInfo.s
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                        : step > stepInfo.s
                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {step > stepInfo.s ? <Check className="h-4 w-4" /> : stepInfo.s}
                  </button>
                  <span className={`ml-2 text-xs font-medium ${step === stepInfo.s ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    {stepInfo.label}
                  </span>
                  {idx < 3 && (
                    <div className={`h-[2px] w-8 md:w-16 mx-4 ${step > stepInfo.s ? "bg-primary/50" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            
            {/* PASO 1: Subida de Excel */}
            {step === 1 && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in">
                <h2 className="text-lg font-medium text-card-foreground mb-4">Seleccionar Archivo de Dotación</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Para comenzar, sube el archivo Excel conteniendo la información de los colaboradores.
                </p>

                <div 
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/10 p-12 text-center hover:bg-muted/20 cursor-pointer transition-all duration-300"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".xlsx,.xls" 
                    className="hidden" 
                  />
                  <Upload className="h-12 w-12 text-primary/80 mb-4 animate-bounce" />
                  <span className="text-base font-semibold text-foreground">
                    Arrastra tu archivo aquí o haz clic para explorar
                  </span>
                  <span className="text-xs text-muted-foreground block mt-2">
                    Formatos soportados: Excel (.xlsx, .xls)
                  </span>
                </div>
              </div>
            )}

            {/* PASO 2: Selección de Hoja y Columnas de Salida */}
            {step === 2 && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-medium text-card-foreground">Hojas y Columnas del Reporte</h2>
                    <p className="text-sm text-muted-foreground mt-1">Elige la pestaña del Excel a examinar y qué columnas necesitas en tu archivo final.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Cambiar Excel
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Selector de Hoja */}
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold text-foreground">Hoja de Trabajo a Examinar</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(sheetsData).map(sheetName => (
                        <button
                          key={sheetName}
                          onClick={() => handleSheetChange(sheetName)}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                            selectedSheet === sheetName
                              ? "bg-primary text-primary-foreground border-primary shadow-md"
                              : "bg-card text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1.5" />
                          {sheetName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <hr className="border-border" />

                  {/* Selección de Columnas Moodle */}
                  <div className="grid gap-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold text-foreground">Columnas a Generar en Archivo de Salida</Label>
                      <Button variant="ghost" size="sm" onClick={selectRecommendedColumns} className="text-xs text-primary font-bold hover:bg-primary/10">
                        Usar Recomendadas Moodle
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Haz clic en las columnas que necesitas. Las recomendadas ya se encuentran preseleccionadas.
                    </p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                      {STANDARD_COLUMNS.map(col => {
                        const isSelected = selectedCols.includes(col)
                        const isRec = RECOMMENDED_COLUMNS.includes(col)
                        return (
                          <button
                            key={col}
                            onClick={() => toggleColumnSelection(col)}
                            className={`flex items-center justify-between p-3 rounded-lg border text-left text-xs transition-all duration-200 ${
                              isSelected
                                ? "bg-primary/10 border-primary text-foreground font-semibold shadow-sm"
                                : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            <span className="truncate">{col}</span>
                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : isRec ? (
                              <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0 font-bold">REC</span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-border mt-6">
                    <Button onClick={() => setStep(3)} className="gap-2 px-6 h-10">
                      Configurar Mapeo <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: Mapeo de Columnas y Configuración */}
            {step === 3 && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-medium text-card-foreground">Mapeo de Datos e Inducción</h2>
                    <p className="text-sm text-muted-foreground mt-1">Configura el origen de datos para cada una de las columnas de salida seleccionadas.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Volver a Columnas
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Nombre del Grupo de Inducción */}
                  <div className="grid gap-2 bg-muted/20 p-4 rounded-xl border border-border max-w-2xl">
                    <Label htmlFor="grupo" className="text-sm font-semibold text-foreground">
                      Nombre del Grupo de Inducción
                    </Label>
                    <Input 
                      id="grupo"
                      placeholder="Ej: Grupo Induccion Mayo 2026"
                      value={grupo}
                      onChange={(e) => handleGrupoChange(e.target.value)}
                      className="bg-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este nombre se rellenará en todas las columnas `group1`, `group2`, etc. de los cursos asociados.
                    </p>
                  </div>

                  <hr className="border-border" />

                  {/* Tabla/Lista de Mapeos */}
                  <div>
                    <Label className="text-sm font-semibold text-foreground mb-3 block">Mapeo de Columnas ({selectedCols.length} seleccionadas)</Label>
                    
                    <div className="grid gap-3">
                      {selectedCols.map(col => {
                        const colMapping = mappings[col] || { type: "column", value: "" }
                        return (
                          <div key={col} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border border-border bg-card/60 hover:bg-card transition-all duration-200 gap-4">
                            <div className="flex items-center gap-2 md:w-1/4">
                              <span className="text-sm font-semibold text-foreground">{col}</span>
                              {RECOMMENDED_COLUMNS.includes(col) && (
                                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">RECOMENDADO</span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 w-full md:w-3/4">
                              {/* Selector Tipo */}
                              <select
                                value={colMapping.type}
                                onChange={(e) => handleMappingChange(col, "type", e.target.value as "column" | "fixed")}
                                className="bg-input rounded-lg border border-border px-3 py-2 text-xs font-semibold w-1/3 outline-none"
                              >
                                <option value="column">Columna Excel</option>
                                <option value="fixed">Valor Manual Fijo</option>
                              </select>

                              {/* Selector Valor / Dropdown de Excel */}
                              {colMapping.type === "column" ? (
                                <select
                                  value={colMapping.value}
                                  onChange={(e) => handleMappingChange(col, "value", e.target.value)}
                                  className={`bg-input rounded-lg border px-3 py-2 text-xs w-2/3 outline-none ${
                                    !colMapping.value ? "border-amber-500/50 bg-amber-500/5" : "border-border"
                                  }`}
                                >
                                  <option value="">-- Seleccionar Columna del Excel --</option>
                                  {currentSheetHeaders.map(h => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  placeholder="Escribe el valor fijo..."
                                  value={colMapping.value}
                                  onChange={(e) => handleMappingChange(col, "value", e.target.value)}
                                  className="h-9 text-xs w-2/3"
                                />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-border mt-6 gap-3">
                    <Button 
                      variant="secondary"
                      onClick={handleGetPreview} 
                      disabled={loading || !grupo.trim()}
                      className="gap-2 h-10"
                    >
                      <Eye className="h-4 w-4" /> Previsualizar 10 Filas
                    </Button>
                    <Button 
                      onClick={handleDownloadZip} 
                      disabled={loading || !grupo.trim()}
                      className="gap-2 h-10 px-6 shadow-lg shadow-primary/20"
                    >
                      <Play className="h-4 w-4" /> Generar ZIP Completo
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 4: Previsualización de Datos en Tiempo Real */}
            {step === 4 && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-medium text-card-foreground">Previsualización de Archivos de Salida</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verifica las primeras 10 filas que se generarán por perfil antes de realizar la descarga definitiva.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setStep(3)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Reconfigurar Mapeos
                  </Button>
                </div>

                <div className="space-y-6">
                  {Object.keys(previews).length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border rounded-xl bg-muted/10">
                      <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-foreground font-semibold">No se generaron registros para previsualizar</p>
                      <p className="text-xs text-muted-foreground mt-1">Asegúrate de haber mapeado la columna de "department" o que existan datos válidos.</p>
                    </div>
                  ) : (
                    <>
                      {/* Pestañas de Perfiles */}
                      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                        {Object.entries(previews).map(([pNorm, pData]) => (
                          <button
                            key={pNorm}
                            onClick={() => setActivePreviewTab(pNorm)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                              activePreviewTab === pNorm
                                ? "bg-primary/10 border-primary text-primary shadow-sm"
                                : "bg-card border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            📁 {pData.profile_name} ({pData.rows.length} filas)
                          </button>
                        ))}
                      </div>

                      {/* Tabla de Previsualización */}
                      {activePreviewTab && previews[activePreviewTab] && (
                        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-inner max-h-[400px] overflow-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-muted sticky top-0">
                              <tr>
                                {previews[activePreviewTab].headers.map((h, i) => (
                                  <th key={i} className="p-3 font-semibold border-b border-border whitespace-nowrap text-foreground bg-muted">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previews[activePreviewTab].rows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-muted/40 transition-colors border-b border-border/50">
                                  {row.map((val, cellIdx) => (
                                    <td key={cellIdx} className="p-3 text-muted-foreground whitespace-nowrap truncate max-w-[200px]" title={val}>
                                      {val === "" ? <span className="text-muted-foreground/30 italic">vacio</span> : val}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
                    <p className="text-xs text-muted-foreground">
                      * Mostrando máximo 10 filas por perfil. Los archivos CSV se codificarán en UTF-8 con BOM y separador punto y coma (;).
                    </p>
                    <Button 
                      onClick={handleDownloadZip} 
                      disabled={loading || Object.keys(previews).length === 0}
                      className="gap-2 px-8 h-12 text-base shadow-lg shadow-primary/20"
                    >
                      <Play className="h-5 w-5 animate-pulse" /> Descargar ZIP Completo (.zip)
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Mensajes de Alerta/Éxito */}
            {errorMsg && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3 animate-shake">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary flex items-center gap-3 animate-fade-in">
                <Package className="h-5 w-5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Spinner Global de Carga */}
            {loading && (
              <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-fade-in">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-xl border border-border">
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-foreground block">Procesando planilla Excel</span>
                  <span className="text-xs text-muted-foreground block mt-1">Normalizando campos y cruzando matriz de cursos...</span>
                </div>
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  )
}
