"use client"

import { Upload, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRef, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface FileUploadCardProps {
  title: string
  file: File | null
  setFile: (f: File | null) => void
  c_ini: string
  setC_ini: (v: string) => void
  c_fin: string
  setC_fin: (v: string) => void
  f_ini: string
  setF_ini: (v: string) => void
  f_fin: string
  setF_fin: (v: string) => void
  hoja: string
  setHoja: (v: string) => void
}

export function FileUploadCard({
  title, file, setFile, c_ini, setC_ini, c_fin, setC_fin, f_ini, setF_ini, f_fin, setF_fin, hoja, setHoja
}: FileUploadCardProps) {
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hojasList, setHojasList] = useState<string[]>(["Activa (Por defecto)"])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      
      try {
        const formData = new FormData()
        formData.append("file", selectedFile)
        const res = await fetch("http://127.0.0.1:8000/api/excel/hojas", {
          method: "POST",
          body: formData
        })
        const data = await res.json()
        if (data.hojas && data.hojas.length > 0) {
          setHojasList(["Activa (Por defecto)", ...data.hojas])
        }
      } catch (err) {
        console.error("Error al leer hojas:", err)
      }
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6">
      <h2 className="mb-6 text-base font-semibold text-card-foreground">{title}</h2>

      <div className="mb-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6">
        {file ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <FileSpreadsheet className="h-6 w-6" />
            <span className="text-sm">{file.name}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Ningún archivo seleccionado...</span>
        )}
      </div>

      <div className="mb-6 flex flex-col items-center gap-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".xlsx,.xls,.csv" 
          className="hidden" 
        />
        <Button variant="default" className="w-full max-w-[200px]" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Explorar...
        </Button>

        <Select value={hoja} onValueChange={setHoja}>
          <SelectTrigger className="w-full max-w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {hojasList.map((h, i) => (
              <SelectItem key={i} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor={`c-ini-${title}`} className="text-sm text-muted-foreground">
            Columna Inicial (Ej: A)
          </Label>
          <Input id={`c-ini-${title}`} value={c_ini} onChange={(e) => setC_ini(e.target.value)} placeholder="A" className="bg-input" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`c-fin-${title}`} className="text-sm text-muted-foreground">
            Columna Final (Opcional)
          </Label>
          <Input id={`c-fin-${title}`} value={c_fin} onChange={(e) => setC_fin(e.target.value)} placeholder="Vacío para única" className="bg-input" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`f-ini-${title}`} className="text-sm text-muted-foreground">
            Fila Inicial (Ej: 2)
          </Label>
          <Input id={`f-ini-${title}`} value={f_ini} onChange={(e) => setF_ini(e.target.value)} placeholder="2" className="bg-input" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`f-fin-${title}`} className="text-sm text-muted-foreground">
            Fila Final (Opcional)
          </Label>
          <Input id={`f-fin-${title}`} value={f_fin} onChange={(e) => setF_fin(e.target.value)} placeholder="Vacío hasta el final" className="bg-input" />
        </div>
      </div>
    </div>
  )
}
