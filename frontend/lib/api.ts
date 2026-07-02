/**
 * API base:
 * - Vacío (default): mismo origen + proxy Next `/api` → ideal en local y Vercel.
 * - URL absoluta: llamada directa al backend (Excels grandes; requiere CROSS_SITE_AUTH en el API).
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

/** Backend directo para subidas grandes (evita proxy lento de Next en dev). */
export const DIRECT_BACKEND =
  process.env.NEXT_PUBLIC_DIRECT_BACKEND_URL ?? "http://127.0.0.1:8000"

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  if (!API_BASE) return normalized
  const base = API_BASE.replace(/\/+$/, "")
  return `${base}${normalized}`
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  return fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  })
}

export function apiFetchDirect(path: string, init: RequestInit = {}): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`
  const base = (API_BASE || DIRECT_BACKEND).replace(/\/+$/, "")
  const headers = new Headers(init.headers)
  return fetch(`${base}${normalized}`, {
    ...init,
    headers,
    credentials: "include",
  })
}
