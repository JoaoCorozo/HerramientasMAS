"use client"

import { useTheme } from "@/components/theme-provider"
import { THEME_PRESETS, type ThemePreset } from "@/lib/themes"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Settings2, Sun, Moon, Check } from "lucide-react"

export function ThemeSettings() {
  const { resolvedTheme, themePreset, setTheme, setThemePreset } = useTheme()

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Apariencia"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Settings2 className="h-5 w-5 shrink-0" />
          <span>Apariencia</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        collisionPadding={16}
        className="z-[200] w-80 p-0 overflow-hidden"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Apariencia</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Modo claro/oscuro y estilo visual de toda la app
          </p>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Modo
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                resolvedTheme === "light"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-foreground hover:bg-muted"
              )}
            >
              <Sun className="h-4 w-4" />
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                resolvedTheme === "dark"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-foreground hover:bg-muted"
              )}
            >
              <Moon className="h-4 w-4" />
              Oscuro
            </button>
          </div>
        </div>

        <div className="px-4 py-3 max-h-[280px] overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Estilo visual
          </p>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((preset) => {
              const colors =
                resolvedTheme === "dark" ? preset.preview.dark : preset.preview.light
              const selected = themePreset === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setThemePreset(preset.id as ThemePreset)}
                  className={cn(
                    "relative flex flex-col rounded-lg border p-2 text-left transition-all hover:border-primary/50",
                    selected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border"
                  )}
                >
                  <div
                    className="mb-2 h-12 w-full overflow-hidden rounded-md border border-black/10 flex"
                  >
                    <div className="flex-1" style={{ background: colors[0] }} />
                    <div className="w-1/3" style={{ background: colors[1] }} />
                    <div
                      className="w-1/4 border-l border-black/5"
                      style={{ background: colors[2] }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground leading-tight">
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                    {preset.description}
                  </span>
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
