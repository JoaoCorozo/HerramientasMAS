"use client"

import { useState } from "react"
import { BookOpen } from "lucide-react"
import { apiFetch } from "@/lib/api"

export function ManualDownloadButton() {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await apiFetch("/api/manual/usuario")
      if (!res.ok) {
        throw new Error("No se pudo descargar el manual")
      }
      const blob = await res.blob()
      const disp = res.headers.get("content-disposition") || ""
      let name = "Manual_Herramientas_LMS.docx"
      const match = disp.match(/filename="?([^";]+)"?/i)
      if (match?.[1]) name = match[1]
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      window.alert(e instanceof Error ? e.message : "Error al descargar el manual")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground disabled:opacity-50"
      title="Descarga un Word solo con los módulos a los que tienes acceso"
    >
      <BookOpen className="h-5 w-5" />
      <span>{loading ? "Generando…" : "Descargar manual"}</span>
    </button>
  )
}
