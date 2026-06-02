/** Enlace al Mail Composer BEX (gestiondepersonasbex). */
export const MAIL_COMPOSER_BASE =
  "https://www.gestiondepersonasbex.cl/api/mail_composer.php"
export const MAIL_COMPOSER_API_KEY =
  "YD6eLhj8W55FZmd7k-7Xw0MHlvZx7DMq9vEjCz8xYijubE1O"

export type MailComposerPrefill = {
  courseId?: string
  groupId?: string
  groupName?: string
  subject?: string
  body?: string
  autoLoadRecipients?: boolean
}

export type RecordatorioLike = {
  titulo?: string
  detalle?: string
  curso?: string
  grupo?: string
  grupo_id?: string
  asunto?: string
  cuerpo_mail?: string
  ruta?: string
}

/** Devuelve mensaje de error o null si la tarea está lista para Mail Composer. */
export function validateRecordatorioForMail(evt: RecordatorioLike): string | null {
  if (!evt.curso?.trim()) return "Debe indicar el ID del curso."
  if (!evt.grupo?.trim()) return "Debe indicar el grupo (nombre exacto como en Moodle)."
  if (!evt.asunto?.trim()) return "Debe indicar el asunto del correo."
  const body = (evt.cuerpo_mail || evt.detalle || "").trim()
  if (!body) return "Debe indicar el cuerpo del correo."
  return null
}

export function recordatorioToMailPrefill(evt: RecordatorioLike): MailComposerPrefill {
  return {
    courseId: evt.curso?.trim() || undefined,
    groupId: evt.grupo_id?.trim() || undefined,
    groupName: evt.grupo?.trim() || undefined,
    subject: evt.asunto?.trim() || undefined,
    body: (evt.cuerpo_mail || evt.detalle || "").trim() || undefined,
    autoLoadRecipients: false,
  }
}

export function buildMailComposerUrl(prefill: MailComposerPrefill = {}): string {
  const params = new URLSearchParams()
  params.set("key", MAIL_COMPOSER_API_KEY)

  const course = (prefill.courseId || "").trim()
  if (course) {
    params.set("courseid", course)
    params.set("curso", course)
  }

  const groupId = (prefill.groupId || "").trim()
  if (groupId) {
    params.set("idgroup", groupId)
    params.set("grupo_id", groupId)
  }

  const groupName = (prefill.groupName || "").trim()
  if (groupName) {
    params.set("grupo", groupName)
  }

  const subject = (prefill.subject || "").trim()
  if (subject) {
    params.set("subject", subject)
    params.set("asunto", subject)
  }

  const body = (prefill.body || "").trim()
  if (body) {
    params.set("body", body)
    params.set("cuerpo", body)
  }

  if (prefill.autoLoadRecipients) {
    params.set("autoload", "1")
  }

  return `${MAIL_COMPOSER_BASE}?${params.toString()}`
}

export function buildGmailComposeUrl(opts: {
  subject?: string
  body?: string
  to?: string
}): string {
  const params = new URLSearchParams()
  if (opts.to) params.set("to", opts.to)
  if (opts.subject) params.set("su", opts.subject)
  if (opts.body) params.set("body", opts.body)
  const q = params.toString()
  return `https://mail.google.com/mail/?view=cm&fs=1${q ? `&${q}` : ""}`
}
