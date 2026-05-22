"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { apiFetch } from "@/lib/api"

export interface User {
  id: number
  username: string
  role: string
  permissions: string[]
}

interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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

  useEffect(() => {
    apiFetch("/api/auth/me")
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
        if (pathname !== "/login") {
          router.push("/login")
        }
      })
  }, [])

  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login") {
      router.push("/login")
    }
  }, [isLoading, user, pathname, router])

  const login = (newUser: User) => {
    setUser(newUser)
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        Cargando...
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
