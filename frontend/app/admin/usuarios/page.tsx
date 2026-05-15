"use client"

import { useState, useEffect } from "react"
import { useAuth, User } from "@/components/auth-provider"
import { Users, UserPlus, Pencil, Trash2 } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"

const MODULES = [
  { id: "comparador", label: "Comparador de Datos" },
  { id: "rut", label: "Normalizador RUT" },
  { id: "textos", label: "Normalizador Textos" },
  { id: "capacitaciones", label: "Capacitaciones" },
  { id: "enlaces", label: "Enlaces" },
  { id: "recordatorios", label: "Recordatorios" },
]

export default function UsuariosPage() {
  const { token, user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("user")
  const [permissions, setPermissions] = useState<string[]>([])

  const fetchUsers = async () => {
    if (!token) return
    try {
      const res = await fetch("http://localhost:8000/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    const payload = {
      username,
      password,
      role,
      permissions
    }

    const url = isEditing ? `http://localhost:8000/api/users/${currentId}` : "http://localhost:8000/api/users"
    const method = isEditing ? "PUT" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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
      const res = await fetch(`http://localhost:8000/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
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
    setPassword("") // Do not set password, left blank to not change it
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
    setPermissions(prev => 
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    )
  }

  if (user?.role !== "superadmin") {
    return <div className="p-8 text-red-500">Acceso denegado</div>
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Usuarios</h1>
            <p className="text-muted-foreground mt-1">Crea usuarios y asigna permisos a los módulos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Listado */}
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
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-sidebar-border last:border-0 hover:bg-sidebar-accent/50 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">{u.id}</td>
                        <td className="px-4 py-3 text-foreground">{u.username}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${u.role === 'superadmin' ? 'bg-primary/20 text-primary' : 'bg-gray-500/20 text-gray-300'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                          {u.role === 'superadmin' ? 'Todos' : u.permissions.join(', ')}
                        </td>
                        <td className="px-4 py-3 flex gap-2">
                          <button onClick={() => editUser(u)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded transition-colors" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {u.username !== "admin" && (
                            <button onClick={() => handleDelete(u.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Eliminar">
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

          {/* Formulario */}
          <div className="rounded-xl border border-sidebar-border bg-sidebar p-6 shadow-sm h-fit sticky top-8">
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> {isEditing ? "Editar Usuario" : "Nuevo Usuario"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Username</label>
                <input required type="text" value={username} onChange={e => setUsername(e.target.value)} disabled={isEditing && username === "admin"} className="w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Password {isEditing && <span className="text-xs text-muted-foreground font-normal">(Dejar en blanco para mantener)</span>}</label>
                <input required={!isEditing} type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Rol</label>
                <select value={role} onChange={e => setRole(e.target.value)} disabled={isEditing && username === "admin"} className="w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="user">Usuario Regular</option>
                  <option value="superadmin">Super Administrador</option>
                </select>
              </div>

              {role === "user" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Permisos de Módulos</label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto p-2 border border-sidebar-border rounded-md bg-background/50">
                    {MODULES.map(mod => (
                      <label key={mod.id} className="flex items-center gap-2 cursor-pointer hover:bg-sidebar-accent/50 p-1.5 rounded transition-colors">
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
                <button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-md text-sm transition-colors">
                  {isEditing ? "Actualizar" : "Crear Usuario"}
                </button>
                {isEditing && (
                  <button type="button" onClick={resetForm} className="flex-1 bg-sidebar-accent hover:bg-sidebar-accent/80 text-foreground font-medium py-2 rounded-md text-sm transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
