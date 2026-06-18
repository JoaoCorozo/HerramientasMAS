"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Database,
  GraduationCap,
  Link2,
  CalendarDays,
  FileText,
  Type,
  LayoutGrid,
  LogOut,
  Users,
  Film,
  FileSpreadsheet,
} from "lucide-react"
import { ThemeSettings } from "@/components/theme-settings"
import { GeneradorNominaMenu } from "@/components/generador-nomina-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "./auth-provider"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  moduleName?: string
}

const navItems: NavItem[] = [
  { icon: Database, label: "Comparador de Datos", href: "/", moduleName: "comparador" },
  { icon: FileText, label: "Normalizador RUT", href: "/rut", moduleName: "rut" },
  { icon: Type, label: "Normalizador Textos", href: "/textos", moduleName: "textos" },
  { icon: GraduationCap, label: "Capacitaciones Mod 1", href: "/capacitaciones", moduleName: "capacitaciones" },
  { icon: Link2, label: "Enlaces de Interes", href: "/enlaces", moduleName: "enlaces" },
  { icon: CalendarDays, label: "Calendario & Tareas", href: "/recordatorios", moduleName: "recordatorios" },
  { icon: FileSpreadsheet, label: "Reporte Consulta Cursos", href: "/consulta-cursos", moduleName: "consulta_cursos" },
]

function canAccessModule(
  user: NonNullable<ReturnType<typeof useAuth>["user"]>,
  moduleName: string
) {
  if (user.role === "superadmin") return true
  return user.permissions.includes(moduleName)
}

function isVideoPath(pathname: string) {
  return pathname === "/generador/videos" || pathname.startsWith("/generador/videos/")
}

function isNominaPath(pathname: string) {
  return (
    pathname === "/generador" ||
    (pathname.startsWith("/generador/") && !isVideoPath(pathname))
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  if (!user) return null

  const filteredNavItems = navItems.filter((item) => {
    if (!item.moduleName) return false
    return canAccessModule(user, item.moduleName)
  })

  const showGenerador = canAccessModule(user, "generador")
  const generadorActive = isNominaPath(pathname) || isVideoPath(pathname)
  const videoActive = isVideoPath(pathname)

  return (
    <aside className="relative z-[90] flex h-screen w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <LayoutGrid className="h-5 w-5 text-primary" />
        </div>
        <span className="text-base font-semibold text-sidebar-foreground">Herramientas</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            )
          })}

          {showGenerador && (
            <li className="pt-2">
              <div
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide",
                  generadorActive ? "text-primary" : "text-sidebar-foreground/50"
                )}
              >
                Generador de Cargas
              </div>
              <ul className="space-y-1">
                <GeneradorNominaMenu />
                <li>
                  <Link
                    href="/generador/videos"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg py-2.5 pl-6 pr-3 text-sm font-medium transition-colors",
                      videoActive
                        ? "bg-sidebar-accent text-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Film className="h-4 w-4 shrink-0" />
                    Paquetes de Video
                  </Link>
                </li>
              </ul>
            </li>
          )}
        </ul>

        <div className="mt-4 space-y-1 border-t border-sidebar-border pt-4">
          {user.role === "superadmin" && (
            <Link
              href="/admin/usuarios"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname === "/admin/usuarios"
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Users className="h-5 w-5" />
              Administrar Usuarios
            </Link>
          )}
        </div>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-4">
        <ThemeSettings />

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10 hover:text-red-500"
        >
          <LogOut className="h-5 w-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
