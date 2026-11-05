import { Download } from "lucide-react"

interface TemplateDownloadProps {
  href: string
  label?: string
}

/** Enlace para descargar plantilla de ejemplo desde /public/templates. */
export function TemplateDownload({
  href,
  label = "Descargar plantilla",
}: TemplateDownloadProps) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      <Download className="h-3.5 w-3.5 shrink-0" />
      {label}
    </a>
  )
}
