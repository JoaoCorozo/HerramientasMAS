"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { apiFetch } from "@/lib/api"

export interface User {
  id: number
  username: string
  role: string
  permissions: string[]
  email?: string
  must_change_password?: boolean
}

interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  setUserAfterPasswordChange: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PUBLIC_PATHS = new Set(["/login"])

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" })
    } catch {
      /* ignorar error de red al cerrar sesión */
    }
    setUser(null)
    router.push("/login")
  }

  const setUserAfterPasswordChange = () => {
    setUser((prev) => (prev ? { ...prev, must_change_password: false } : prev))
    router.push("/")
  }

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    apiFetch("/api/auth/me", { signal: controller.signal })
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error("No autenticado")
      })
      .then((userData) => {
        setUser(userData)
        setIsLoading(false)
      })
      .catch(() => {
        setUser(null)
        setIsLoading(false)
        if (!PUBLIC_PATHS.has(pathname)) {
          router.push("/login")
        }
      })
      .finally(() => clearTimeout(timeout))

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      if (!PUBLIC_PATHS.has(pathname)) {
        router.push("/login")
      }
      return
    }

    if (user.must_change_password) {
      if (pathname !== "/cambiar-clave") {
        router.push("/cambiar-clave")
      }
      return
    }

    if (pathname === "/login" || pathname === "/cambiar-clave") {
      router.push("/")
    }
  }, [isLoading, user, pathname, router])

  const login = (newUser: User) => {
    setUser(newUser)
    if (newUser.must_change_password) {
      router.push("/cambiar-clave")
    } else {
      router.push("/")
    }
  }

  if (isLoading && !PUBLIC_PATHS.has(pathname) && pathname !== "/cambiar-clave") {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        Cargando...
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, setUserAfterPasswordChange, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
