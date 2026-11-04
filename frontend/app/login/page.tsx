"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { apiFetch, apiUrl } from "@/lib/api"
import { Lock, User } from "lucide-react"

type OidcStatus = {
  enabled: boolean
  tenants: { id: string; label: string }[]
  local_login_enabled: boolean
}

function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [oidc, setOidc] = useState<OidcStatus | null>(null)
  const { login } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const ssoError = searchParams.get("sso_error")
    if (ssoError) setError(ssoError)
    apiFetch("/api/auth/oidc/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setOidc(data as OidcStatus)
      })
      .catch(() => setOidc(null))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const formData = new URLSearchParams()
      formData.append("username", username)
      formData.append("password", password)

      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      })

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error("El servidor no responde. Avisa a sistemas (API/backend).")
        }
        throw new Error("Credenciales incorrectas")
      }

      const meResponse = await apiFetch("/api/auth/me")
      if (!meResponse.ok) throw new Error("Error obteniendo usuario")

      const userData = await meResponse.json()
      login(userData)
      router.replace("/")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const localEnabled = oidc?.local_login_enabled !== false
  const showSso = Boolean(oidc?.enabled && oidc.tenants.length)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-sidebar-border bg-sidebar p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bienvenido</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {showSso
              ? "Ingresa con SSO (Google vía Authentik) o con tu usuario local"
              : "Ingresa tus credenciales para acceder a las herramientas"}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20">
            {error}
          </div>
        )}

        {showSso && (
          <div className="space-y-3 mb-6">
            {oidc!.tenants.map((t) => (
              <a
                key={t.id}
                href={apiUrl(`/api/auth/oidc/login?tenant=${encodeURIComponent(t.id)}`)}
                className="flex w-full items-center justify-center rounded-lg border border-sidebar-border bg-background py-2.5 text-sm font-semibold text-foreground transition-all hover:border-primary hover:bg-primary/5"
              >
                Continuar con {t.label}
              </a>
            ))}
            {localEnabled && (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-sidebar-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-sidebar px-2 text-muted-foreground">o usuario local</span>
                </div>
              </div>
            )}
          </div>
        )}

        {localEnabled && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-sidebar-border bg-background py-2 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ingresa tu usuario"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-sidebar-border bg-background py-2 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 mt-6"
            >
              {loading ? "Ingresando..." : "Iniciar Sesión"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
