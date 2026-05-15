"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

export interface User {
  id: number
  username: string
  role: string
  permissions: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token")
    if (storedToken) {
      setToken(storedToken)
      fetch("http://localhost:8000/api/auth/me", {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      })
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error("Token invalido")
        })
        .then((userData) => {
          setUser(userData)
          setIsLoading(false)
        })
        .catch(() => {
          logout()
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
      if (pathname !== "/login") {
        router.push("/login")
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login") {
      router.push("/login")
    }
  }, [isLoading, user, pathname, router])

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("auth_token", newToken)
    setToken(newToken)
    setUser(newUser)
    router.push("/")
  }

  const logout = () => {
    localStorage.removeItem("auth_token")
    setToken(null)
    setUser(null)
    router.push("/login")
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Cargando...</div>
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
