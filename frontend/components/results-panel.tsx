"use client"

import { FileSearch } from "lucide-react"

interface ResultsPanelProps {
  status: "waiting" | "processing" | "complete"
  results?: string[]
}

export function ResultsPanel({ status }: ResultsPanelProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex min-h-[200px] flex-col items-center justify-center p-8">
        {status === "waiting" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileSearch className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Esperando parametros</p>
              <p className="text-sm text-muted-foreground">
                Configura los archivos y presiona el boton para comenzar
              </p>
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Procesando comparacion...</p>
          </div>
        )}
      </div>
    </div>
  )
}
