"use client"

import Link from "next/link"
import { Building2, FileDown, Info, LayoutGrid, Lock } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import {
  GENERADOR_CLIENTES,
  GENERADOR_GUIA_PDF,
  GENERADOR_INFO_TEXTO,
} from "@/lib/generador-clientes"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export default function GeneradorHubPage() {
  useAuth()

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl min-w-0 px-8 py-8">
          <header className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    Generador de Nóminas
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Elige el cliente para acceder a su generador de cargas.
                  </p>
                </div>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-full"
                    aria-label="Información del generador"
                  >
                    <Info className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <p className="text-sm leading-relaxed text-foreground">{GENERADOR_INFO_TEXTO}</p>
                  <Button variant="secondary" size="sm" className="mt-4 w-full gap-2" asChild>
                    <a href={GENERADOR_GUIA_PDF} download target="_blank" rel="noopener noreferrer">
                      <FileDown className="h-4 w-4" />
                      Descargar guía (PDF)
                    </a>
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Si el PDF aún no está publicado, el enlace estará disponible cuando se suba la guía.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GENERADOR_CLIENTES.map((cliente) => {
              const contenido = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    {!cliente.disponible && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Próximo
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-foreground">{cliente.nombre}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{cliente.descripcion}</p>
                </>
              )

              if (cliente.disponible && cliente.href) {
                return (
                  <Link
                    key={cliente.id}
                    href={cliente.href}
                    className={cn(
                      "group rounded-xl border border-border bg-card p-6 shadow-sm transition-all",
                      "hover:border-primary/50 hover:bg-card/80 hover:shadow-md"
                    )}
                  >
                    {contenido}
                    <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">
                      Abrir generador →
                    </span>
                  </Link>
                )
              }

              return (
                <div
                  key={cliente.id}
                  className="rounded-xl border border-dashed border-border bg-muted/20 p-6 opacity-80"
                >
                  {contenido}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
