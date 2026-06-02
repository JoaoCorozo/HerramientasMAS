"use client"

import { useMemo } from "react"
import { Copy, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { buildMailComposerUrl, recordatorioToMailPrefill, type RecordatorioLike } from "@/lib/mail-composer"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: RecordatorioLike | null
}

export function MailComposerLaunchDialog({ open, onOpenChange, task }: Props) {
  const url = useMemo(() => {
    if (!task) return ""
    return buildMailComposerUrl(recordatorioToMailPrefill(task))
  }, [task])

  const prefillScriptUrl =
    typeof window !== "undefined" ? `${window.location.origin}/mail-composer-prefill.js` : "/mail-composer-prefill.js"

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert(`${label} copiado al portapapeles.`)
    } catch {
      alert("No se pudo copiar. Seleccione el texto manualmente.")
    }
  }

  if (!task) return null

  const rows = [
    { label: "Curso (ID)", value: task.curso || "" },
    { label: "Grupo", value: task.grupo || "" },
    { label: "Asunto", value: task.asunto || "" },
    { label: "Cuerpo", value: task.cuerpo_mail || task.detalle || "" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mail Composer</DialogTitle>
          <DialogDescription>
            Se abrió una pestaña nueva. Si los campos están vacíos, el sitio externo aún no tiene el script de
            precarga (solo hay que configurarlo una vez).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
            <p className="font-semibold mb-1">Configuración única en gestiondepersonasbex.cl</p>
            <p className="text-xs mb-2">
              En <code className="bg-black/10 px-1 rounded">mail_composer.php</code>, antes de{" "}
              <code className="bg-black/10 px-1 rounded">&lt;/body&gt;</code>, agregue:
            </p>
            <pre className="text-[10px] bg-black/20 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
              {`<script src="${prefillScriptUrl}" defer></script>`}
            </pre>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => copy(`<script src="${prefillScriptUrl}" defer></script>`, "Script")}
            >
              <Copy className="h-3 w-3 mr-1" /> Copiar línea del script
            </Button>
          </div>

          <div>
            <p className="text-muted-foreground text-xs mb-1">Enlace generado (incluye sus datos):</p>
            <p className="text-xs break-all font-mono bg-muted p-2 rounded border">{url}</p>
            <div className="flex gap-2 mt-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => copy(url, "Enlace")}>
                <Copy className="h-3 w-3 mr-1" /> Copiar enlace
              </Button>
              <Button type="button" size="sm" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir de nuevo
              </Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Mientras tanto, puede pegar manualmente:</p>
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                <div className="min-w-0">
                  <span className="font-medium">{r.label}</span>
                  <p className="text-xs text-muted-foreground truncate">{r.value || "—"}</p>
                </div>
                {r.value && (
                  <Button type="button" size="sm" variant="ghost" className="shrink-0 h-7" onClick={() => copy(r.value, r.label)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
