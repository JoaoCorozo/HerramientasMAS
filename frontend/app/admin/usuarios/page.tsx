"use client"

import { useState, useEffect } from "react"
import { useAuth, User } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import { Users, UserPlus, Pencil, Trash2, Mail, Shield } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MODULES = [
  { id: "comparador", label: "Comparador de Datos" },
  { id: "rut", label: "Normalizador RUT" },
  { id: "textos", label: "Normalizador Textos" },
  { id: "capacitaciones", label: "Capacitaciones" },
  { id: "enlaces", label: "Enlaces" },
  { id: "recordatorios", label: "Recordatorios" },
  { id: "generador", label: "Generador de Cargas" },
  { id: "consulta_cursos", label: "Reporte Consulta Cursos" },
  { id: "usuarios_duplicados", label: "Usuarios Duplicados" },
  { id: "compresor_video", label: "Compresor MP4" },
]

export default function UsuariosPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("user")
  const [permissions, setPermissions] = useState<string[]>([])

  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPass, setSmtpPass] = useState("")
  const [smtpSenderName, setSmtpSenderName] = useState("")
  const [smtpSenderEmail, setSmtpSenderEmail] = useState("")
  const [smtpLoading, setSmtpLoading] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)

  const fetchUsers = async () => {
    if (!user) return
    try {
      const res = await apiFetch("/api/users")
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSmtpConfig = async () => {
    if (!user) return
    setSmtpLoading(true)
    try {
      const res = await apiFetch("/api/db/smtp_config")
      if (res.ok) {
        const data = await res.json()
        if (data && typeof data === "object") {
          setSmtpHost(data.host || "")
          setSmtpPort(data.port || "")
          setSmtpUser(data.username || "")
          setSmtpPass(data.password || "")
          setSmtpSenderName(data.sender_name || "")
          setSmtpSenderEmail(data.sender_email || "")
        }
      }
    } catch (e) {
      console.error("Error loading SMTP config:", e)
    } finally {
      setSmtpLoading(false)
    }
  }

  const saveSmtpConfig = async () => {
    if (!user) return
    setSmtpSaving(true)
    try {
      const res = await apiFetch("/api/db/smtp_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          username: smtpUser,
          password: smtpPass,
          sender_name: smtpSenderName,
          sender_email: smtpSenderEmail,
        }),
      })
      if (res.ok) {
        alert("Configuración SMTP guardada exitosamente.")
      } else {
        alert("Error al guardar la configuración SMTP.")
      }
    } catch (e) {
      console.error("Error saving SMTP config:", e)
      alert("Error de conexión al guardar configuración SMTP.")
    } finally {
      setSmtpSaving(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchSmtpConfig()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const payload = {
      username,
      password,
      role,
      permissions,
    }

    const path = isEditing ? `/api/users/${currentId}` : "/api/users"
    const method = isEditing ? "PUT" : "POST"

    try {
      const res = await apiFetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        resetForm()
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.detail || "Error guardando usuario")
      }
    } catch (error) {
      console.error(error)
      alert("Error de conexión")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar usuario?")) return
    try {
      const res = await apiFetch(`/api/users/${id}`, { method: "DELETE" })
      if (res.ok) fetchUsers()
      else alert("Error eliminando usuario")
    } catch (error) {
      console.error(error)
    }
  }

  const editUser = (u: User) => {
    setIsEditing(true)
    setCurrentId(u.id)
    setUsername(u.username)
    setPassword("")
    setRole(u.role)
    setPermissions(u.permissions)
  }

  const resetForm = () => {
    setIsEditing(false)
    setCurrentId(null)
    setUsername("")
    setPassword("")
    setRole("user")
    setPermissions([])
  }

  const togglePermission = (modId: string) => {
    setPermissions((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    )
  }

  if (user?.role !== "superadmin") {
    return <div className="p-8 text-red-500">Acceso denegado</div>
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Panel de Administrador
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona usuarios y la configuración SMTP de notificaciones
          </p>
        </div>

        <Tabs defaultValue="usuarios" className="gap-6">
          <TabsList>
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="smtp" className="gap-2">
              <Mail className="h-4 w-4" />
              SMTP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-xl border border-sidebar-border bg-sidebar p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5" /> Usuarios Registrados
                </h2>
                {loading ? (
                  <p className="text-muted-foreground">Cargando...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-sidebar-accent">
                        <tr>
                          <th className="px-4 py-3 rounded-l-lg">ID</th>
                          <th className="px-4 py-3">Usuario</th>
                          <th className="px-4 py-3">Rol</th>
                          <th className="px-4 py-3">Permisos</th>
                          <th className="px-4 py-3 rounded-r-lg">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr
                            key={u.id}
                            className="border-b border-sidebar-border last:border-0 hover:bg-sidebar-accent/50 transition-colors"
                          >
                            <td className="px-4 py-3 text-foreground font-medium">{u.id}</td>
                            <td className="px-4 py-3 text-foreground">{u.username}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  u.role === "superadmin"
                                    ? "bg-primary/20 text-primary"
                                    : "bg-gray-500/20 text-gray-300"
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                              {u.role === "superadmin" ? "Todos" : u.permissions.join(", ")}
                            </td>
                            <td className="px-4 py-3 flex gap-2">
                              <button
                                onClick={() => editUser(u)}
                                className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {u.username !== "admin" && (
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-sidebar-border bg-sidebar p-6 shadow-sm h-fit sticky top-8">
                <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                  <UserPlus className="h-5 w-5" /> {isEditing ? "Editar Usuario" : "Nuevo Usuario"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Username</label>
                    <input
                      required
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isEditing && username === "admin"}
                      className="w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">
                      Password{" "}
                      {isEditing && (
                        <span className="text-xs text-muted-foreground font-normal">
                          (Dejar en blanco para mantener)
                        </span>
                      )}
                    </label>
                    <input
                      required={!isEditing}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Rol</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={isEditing && username === "admin"}
                      className="w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      <option value="user">Usuario Regular</option>
                      <option value="superadmin">Super Administrador</option>
                    </select>
                  </div>

                  {role === "user" && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Permisos de Módulos
                      </label>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto p-2 border border-sidebar-border rounded-md bg-background/50">
                        {MODULES.map((mod) => (
                          <label
                            key={mod.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-sidebar-accent/50 p-1.5 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={permissions.includes(mod.id)}
                              onChange={() => togglePermission(mod.id)}
                              className="rounded border-sidebar-border bg-background text-primary focus:ring-primary h-4 w-4"
                            />
                            <span className="text-sm text-foreground">{mod.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-md text-sm transition-colors"
                    >
                      {isEditing ? "Actualizar" : "Crear Usuario"}
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="flex-1 bg-sidebar-accent hover:bg-sidebar-accent/80 text-foreground font-medium py-2 rounded-md text-sm transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="smtp">
            <div className="max-w-xl rounded-xl border border-sidebar-border bg-sidebar p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-1 text-foreground flex items-center gap-2">
                <Mail className="h-5 w-5" /> Configuración SMTP
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Usada para enviar notificaciones de Calendario &amp; Tareas. Aplica a todos los usuarios.
              </p>

              {smtpLoading ? (
                <p className="text-muted-foreground">Cargando configuración...</p>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Servidor SMTP (Host)</Label>
                    <Input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com o smtp.office365.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Puerto</Label>
                      <Input
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="587"
                      />
                    </div>
                    <div className="flex items-end">
                      <span className="text-xs text-muted-foreground pb-2">
                        Normalmente 587 (TLS) o 465 (SSL)
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Usuario / Correo de acceso</Label>
                    <Input
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="usuario@gmail.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Contraseña</Label>
                    <Input
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="Contraseña de aplicación"
                      type="password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nombre del remitente</Label>
                    <Input
                      value={smtpSenderName}
                      onChange={(e) => setSmtpSenderName(e.target.value)}
                      placeholder="Plataforma de Herramientas BEX"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Correo del remitente</Label>
                    <Input
                      value={smtpSenderEmail}
                      onChange={(e) => setSmtpSenderEmail(e.target.value)}
                      placeholder="remitente@correo.com"
                    />
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={saveSmtpConfig}
                      disabled={smtpSaving}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {smtpSaving ? "Guardando..." : "Guardar configuración"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
