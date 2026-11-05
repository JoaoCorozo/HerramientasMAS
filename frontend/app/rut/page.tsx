"use client"

import { useState } from "react"
import { FileText, Copy, Play } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Checkbox } from "@/components/ui/checkbox"

export default function RutPage() {
  const [formato, setFormato] = useState("Formato Original (Normalizado)")
  const [kMinuscula, setKMinuscula] = useState(false)
  const [generarDv, setGenerarDv] = useState(false)
  const [validar, setValidar] = useState(true)
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [total, setTotal] = useState(0)
  const [validos, setValidos] = useState(0)
  const [invalidos, setInvalidos] = useState(0)
  const [dvGenerados, setDvGenerados] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleNormalizar = async () => {
    if (!inputText.trim()) return
    setLoading(true)

    try {
      const response = await apiFetch("/api/rut/normalizar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ruts: inputText,
          formato: formato,
          k_minuscula: kMinuscula,
          generar_dv: generarDv,
          validar: validar,
        }),
      })

      const data = await response.json()
      setOutputText(data.ruts)
      setTotal(data.total || 0)
      setValidos(data.validos || 0)
      setInvalidos(data.invalidos || 0)
      setDvGenerados(data.dv_generados || 0)
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
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Normalizador de RUTs
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Normaliza formato, calcula dígito verificador y valida con módulo 11.
                </p>
              </div>
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

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generar-dv"
                    checked={generarDv}
                    onCheckedChange={(checked) => setGenerarDv(checked === true)}
                  />
                  <label htmlFor="generar-dv" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Calcular dígito verificador (el listado viene sin DV)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="validar-rut"
                    checked={validar}
                    onCheckedChange={(checked) => setValidar(checked === true)}
                  />
                  <label htmlFor="validar-rut" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Validar RUT (módulo 11) y marcar inválidos
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="k-minus"
                    checked={kMinuscula}
                    onCheckedChange={(checked) => setKMinuscula(checked === true)}
                  />
                  <label htmlFor="k-minus" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Convertir dígito verificador &apos;K&apos; a minúscula
                  </label>
                </div>
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
                placeholder={
                  generarDv
                    ? "Un RUT por línea sin dígito, ej:\n20536828\n12345678"
                    : "Ingresa la lista de RUTs...\n20.536.828-0\n12345678-5"
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <div className="flex flex-col rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Resultados {total > 0 && `(${total})`}
                  {total > 0 && (
                    <span className="ml-2 font-normal">
                      · {validos} válidos
                      {dvGenerados > 0 ? ` · ${dvGenerados} DV calculados` : ""}
                      {invalidos > 0 ? ` · ${invalidos} inválidos` : ""}
                    </span>
                  )}
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
              {loading ? "Procesando…" : "Normalizar RUTs"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
