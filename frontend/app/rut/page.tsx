"use client"

import { useState } from "react"
import { FileText, Copy, Play } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Checkbox } from "@/components/ui/checkbox"

export default function RutPage() {
  const [formato, setFormato] = useState("Formato Original (Normalizado)")
  const [kMinuscula, setKMinuscula] = useState(false)
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleNormalizar = async () => {
    if (!inputText.trim()) return
    setLoading(true)
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/rut/normalizar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ruts: inputText,
          formato: formato,
          k_minuscula: kMinuscula
        })
      })
      
      const data = await response.json()
      setOutputText(data.ruts)
      setTotal(data.total)
    } catch (error) {
      console.error("Error al conectar con la API de Python:", error)
      setOutputText("Error al conectar con el motor de Python.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText)
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Normalizador de RUTs
              </h1>
            </div>
          </header>

          <div className="mb-6 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium text-card-foreground">Configuración de Salida</h2>
            
            <div className="space-y-6">
              <div>
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Formato</span>
                <ToggleGroup
                  type="single"
                  value={formato}
                  onValueChange={(value) => value && setFormato(value)}
                  className="justify-start rounded-lg bg-muted p-1"
                >
                  <ToggleGroupItem value="Sin Puntos y Con Guión" className="rounded-md px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    Sin Puntos y Con Guión
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Sin Puntos y Sin Guión" className="rounded-md px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    Sin Puntos y Sin Guión
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Formato Original (Normalizado)" className="rounded-md px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    Formato Original
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="k-minus" checked={kMinuscula} onCheckedChange={(checked) => setKMinuscula(checked as boolean)} />
                <label htmlFor="k-minus" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Convertir dígito verificador 'K' a minúscula
                </label>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Pegar RUTs aquí</span>
              </div>
              <textarea
                className="min-h-[300px] flex-1 resize-none rounded-md bg-muted p-3 font-mono text-sm text-foreground focus:outline-none"
                placeholder="Ingresa la lista de RUTs..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <div className="flex flex-col rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Resultados {total > 0 && `(${total} registros)`}
                </span>
                <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!outputText}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
              </div>
              <textarea
                className="min-h-[300px] flex-1 resize-none rounded-md bg-muted p-3 font-mono text-sm text-foreground focus:outline-none"
                readOnly
                value={outputText}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button size="lg" className="w-full max-w-md" onClick={handleNormalizar} disabled={loading || !inputText}>
              <Play className="mr-2 h-4 w-4" />
              {loading ? "Procesando en Python..." : "Normalizar RUTs"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
