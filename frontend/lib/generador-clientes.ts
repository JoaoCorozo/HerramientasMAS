export interface GeneradorCliente {
  id: string
  nombre: string
  descripcion: string
  href?: string
  disponible: boolean
}

export interface GeneradorNavProceso {
  label: string
  href: string
}

/** Estructura del menú lateral (hover) para Generador de Nóminas */
export interface GeneradorNavCliente {
  id: string
  nombre: string
  disponible: boolean
  procesos: GeneradorNavProceso[]
}

export const GENERADOR_NAV_CLIENTES: GeneradorNavCliente[] = [
  {
    id: "bex",
    nombre: "BEX",
    disponible: true,
    procesos: [{ label: "Cargas e inducciones", href: "/generador/bex" }],
  },
  {
    id: "transelec",
    nombre: "Transelec",
    disponible: true,
    procesos: [
      { label: "Altas de usuarios nuevos", href: "/generador/transelec/altas" },
      { label: "Externos", href: "/generador/transelec/matriz" },
    ],
  },
  {
    id: "aza",
    nombre: "AZA",
    disponible: true,
    procesos: [{ label: "Comparar nóminas", href: "/generador/aza" }],
  },
  {
    id: "resiter",
    nombre: "Resiter",
    disponible: true,
    procesos: [{ label: "Matriz SAP", href: "/generador/resiter" }],
  },
  { id: "carozzi", nombre: "Carozzi", disponible: false, procesos: [] },
  { id: "habitat", nombre: "Habitat", disponible: false, procesos: [] },
  { id: "enaex", nombre: "Enaex", disponible: false, procesos: [] },
  { id: "bi", nombre: "BI", disponible: false, procesos: [] },
]

export const GENERADOR_INFO_TEXTO =
  "Selecciona el cliente para generar las cargas de nóminas e inducciones. Cada generador está adaptado al formato y reglas de dotación del cliente. Si necesitas ayuda, revisa la guía en PDF."

export const GENERADOR_GUIA_PDF = "/docs/generador-nominas-guia.pdf"

export const GENERADOR_CLIENTES: GeneradorCliente[] = [
  {
    id: "bex",
    nombre: "BEX",
    descripcion: "Generador de cargas e inducciones para dotación BEX (Moodle).",
    href: "/generador/bex",
    disponible: true,
  },
  {
    id: "transelec",
    nombre: "Transelec",
    descripcion: "Altas de usuarios nuevos y Externos (nómina ingresos externos en Subestaciones y/o Líneas).",
    href: "/generador/transelec",
    disponible: true,
  },
  {
    id: "aza",
    nombre: "AZA",
    descripcion:
      "Comparador de nóminas cliente vs plataforma (entrada CSV). Descarga Excel con 6 hojas (Diferencias, Ingresos, Salidas, Actualizaciones, Nuevos y Suspender).",
    href: "/generador/aza",
    disponible: true,
  },
  {
    id: "resiter",
    nombre: "Resiter",
    descripcion:
      "Genera CSV Moodle desde matriz Resiter (CSV, Excel o texto pegado). Asigna cursos SAP según perfil operacional, administrativo o CRM.",
    href: "/generador/resiter",
    disponible: true,
  },
  {
    id: "carozzi",
    nombre: "Carozzi",
    descripcion: "Generador de nóminas Carozzi — próximamente.",
    disponible: false,
  },
  {
    id: "habitat",
    nombre: "Habitat",
    descripcion: "Generador de nóminas Habitat — próximamente.",
    disponible: false,
  },
  {
    id: "enaex",
    nombre: "Enaex",
    descripcion: "Generador de nóminas Enaex — próximamente.",
    disponible: false,
  },
  {
    id: "bi",
    nombre: "BI",
    descripcion: "Generador de nóminas BI — próximamente.",
    disponible: false,
  },
]
