"use client"

import Link from "next/link"
import { ArrowLeft, FileSpreadsheet, UserPlus } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"

const PROCESOS = [
  {
    href: "/generador/transelec/altas",
    title: "Altas de usuarios nuevos",
    description:
      "Pega la solicitud del cliente o sube un archivo. Extrae datos, revisa nombre/apellido y genera CSV con todos los cursos del catálogo.",
    icon: UserPlus,
  },
  {
    href: "/generador/transelec/matriz",
    title: "Externos",
    description:
      "Script para generar nómina de ingresos externos en los cursos Subestaciones y/o Líneas de transmisión.",
    icon: FileSpreadsheet,
  },
]

export default function TranselecHubPage() {
  useAuth()

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl min-w-0 px-8 py-8">
          <Link
            href="/generador"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a selección de cliente
          </Link>

          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Generador de Cargas
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Transelec</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige el proceso de nóminas que necesitas ejecutar.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            {PROCESOS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">
                  Abrir →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
