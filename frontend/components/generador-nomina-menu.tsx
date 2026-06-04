"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, ChevronRight, Lock } from "lucide-react"
import { GENERADOR_NAV_CLIENTES } from "@/lib/generador-clientes"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

const FLYOUT_Z = "z-[200]"

function isNominaPath(pathname: string) {
  return (
    pathname === "/generador" ||
    (pathname.startsWith("/generador/") && !pathname.startsWith("/generador/videos"))
  )
}

function isClienteActive(pathname: string, clienteId: string) {
  if (clienteId === "bex") {
    return pathname === "/generador/bex" || pathname.startsWith("/generador/bex/")
  }
  if (clienteId === "transelec") {
    return pathname.startsWith("/generador/transelec")
  }
  return pathname.startsWith(`/generador/${clienteId}`)
}

function flyoutPanelClassName() {
  return cn(
    FLYOUT_Z,
    "w-auto min-w-[12rem] rounded-lg border border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-xl"
  )
}

export function GeneradorNominaMenu() {
  const pathname = usePathname()
  const menuActive = isNominaPath(pathname)

  return (
    <li>
      <HoverCard openDelay={100} closeDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg py-2.5 pl-6 pr-3 text-sm font-medium transition-colors text-left",
              menuActive
                ? "bg-sidebar-accent/60 text-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">Generador de Nóminas</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </HoverCardTrigger>

        <HoverCardContent
          side="right"
          align="start"
          sideOffset={8}
          className={flyoutPanelClassName()}
        >
          <Link
            href="/generador"
            className={cn(
              "block px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-sidebar-accent/50",
              pathname === "/generador" ? "text-primary" : "text-sidebar-foreground/60"
            )}
          >
            Seleccionar cliente
          </Link>
          <ul className="border-t border-sidebar-border py-1">
            {GENERADOR_NAV_CLIENTES.map((cliente) => {
              const clienteActive = isClienteActive(pathname, cliente.id)
              const tieneProcesos = cliente.disponible && cliente.procesos.length > 0

              if (!tieneProcesos) {
                return (
                  <li key={cliente.id}>
                    <div
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-sidebar-foreground/40"
                      title="Próximamente"
                    >
                      <span>{cliente.nombre}</span>
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                    </div>
                  </li>
                )
              }

              return (
                <li key={cliente.id}>
                  <HoverCard openDelay={80} closeDelay={120}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/50 text-left",
                          clienteActive && "bg-sidebar-accent/40 text-primary"
                        )}
                      >
                        <span className="font-medium">{cliente.nombre}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="right"
                      align="start"
                      sideOffset={4}
                      className={cn(flyoutPanelClassName(), "min-w-[14rem]")}
                    >
                      <ul className="py-1">
                        {cliente.procesos.map((proceso) => {
                          const procesoActive =
                            pathname === proceso.href ||
                            pathname.startsWith(`${proceso.href}/`)
                          return (
                            <li key={proceso.href}>
                              <Link
                                href={proceso.href}
                                className={cn(
                                  "block px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/50",
                                  procesoActive
                                    ? "bg-sidebar-accent text-primary font-medium"
                                    : "text-sidebar-foreground/80"
                                )}
                              >
                                {proceso.label}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </HoverCardContent>
                  </HoverCard>
                </li>
              )
            })}
          </ul>
        </HoverCardContent>
      </HoverCard>
    </li>
  )
}
