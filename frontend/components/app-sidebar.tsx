"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Database,
  GraduationCap,
  Link2,
  CalendarDays,
  FileText,
  Type,
  PlusCircle,
  Settings,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
}

const navItems: NavItem[] = [
  { icon: Database, label: "Comparador de Datos", href: "/" },
  { icon: FileText, label: "Normalizador RUT", href: "/rut" },
  { icon: Type, label: "Normalizador Textos", href: "/textos" },
  { icon: GraduationCap, label: "Capacitaciones Mod 1", href: "/capacitaciones" },
  { icon: Link2, label: "Enlaces de Interes", href: "/enlaces" },
  { icon: CalendarDays, label: "Calendario & Tareas", href: "/recordatorios" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <span className="text-base font-semibold text-sidebar-foreground">Herramientas</span>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
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
        </ul>

        <div className="mt-4 pt-4 border-t border-sidebar-border">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
            <PlusCircle className="h-5 w-5" />
            Agregar Modulos...
          </button>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center justify-between rounded-lg bg-sidebar-accent px-3 py-2.5 text-sm font-medium text-sidebar-foreground"
        >
          <span>{theme === "dark" ? "Dark" : "Light"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  )
}
