"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Clapperboard } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { apiFetch } from "@/lib/api"
import "@/styles/compresor-video.css"

interface VideoItem {
  id: string
  name: string
  status: string
  progress?: number
  size?: number
  finalSize?: number
  reductionPercent?: number
  elapsedSeconds?: number
  finishedAt?: string | null
  message?: string
  sourceLabel?: string
  resolution?: number
  zipName?: string
  output?: string
  lmsLabel?: string
  courseId?: string
}

interface ItemsResponse {
  ok?: boolean
  items?: VideoItem[]
  queueActive?: boolean
  queueElapsedSeconds?: number
  warning?: string
  added?: number
  uploaded?: number
  error?: string
  detail?: string
}

const LMS_OPTIONS = [
  { value: "enaex_hispano", label: "Enaex Hispano" },
  { value: "enaex_ingles", label: "Enaex Inglés" },
  { value: "enaex_brasil", label: "Enaex Brasil" },
  { value: "habitat", label: "Habitat" },
  { value: "bex", label: "BEX" },
  { value: "banco_internacional", label: "Banco Internacional" },
  { value: "transelec", label: "Transelec" },
  { value: "aza", label: "AZA" },
  { value: "carozzi", label: "Carozzi" },
] as const

function formatBytes(bytes?: number) {
  if (!bytes) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let size = Number(bytes)
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDuration(seconds?: number) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)))
  const h = String(Math.floor(total / 3600)).padStart(2, "0")
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const s = String(total % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    queued: "Pendiente",
    running: "Procesando",
    done: "Finalizado",
    error: "Error",
    canceled: "Cancelado",
  }
  return labels[status] || status
}

function isValidLms(value: string) {
  return LMS_OPTIONS.some((opt) => opt.value === value)
}

export default function CompresorVideosPage() {
  useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<number | null>(null)

  const [resolution, setResolution] = useState(720)
  const [items, setItems] = useState<VideoItem[]>([])
  const [queueActive, setQueueActive] = useState(false)
  const [queueElapsedSeconds, setQueueElapsedSeconds] = useState(0)
  const [alertMsg, setAlertMsg] = useState("")
  const [alertType, setAlertType] = useState<"error" | "info">("error")
  const [modalOpen, setModalOpen] = useState(false)
  const [lms, setLms] = useState("")
  const [courseId, setCourseId] = useState("")
  const [modalError, setModalError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState("")
  const [confirming, setConfirming] = useState(false)

  const parseResponse = async (response: Response): Promise<ItemsResponse> => {
    let data: ItemsResponse = {}
    try {
      data = (await response.json()) as ItemsResponse
    } catch {
      if (!response.ok) {
        throw new Error(`Error del servidor (${response.status})`)
      }
    }
    if (!response.ok || data.ok === false) {
      throw new Error(data.detail || data.error || "No se pudo completar la acción.")
    }
    return data
  }

  const requestJson = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers)
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json")
    }
    const response = await apiFetch(path, { ...options, headers })
    return parseResponse(response)
  }, [])

  const uploadOneVideo = useCallback(async (file: File, signal: AbortSignal) => {
    const formData = new FormData()
    formData.append("files", file)
    const response = await apiFetch("/api/compresor-video/upload", {
      method: "POST",
      body: formData,
      signal,
    })
    return parseResponse(response)
  }, [])

  const applyItemsResponse = useCallback((data: ItemsResponse) => {
    setItems(data.items || [])
    setQueueActive(Boolean(data.queueActive))
    setQueueElapsedSeconds(Number(data.queueElapsedSeconds || 0))
  }, [])

  const refresh = useCallback(async () => {
    const data = await requestJson("/api/compresor-video/items")
    applyItemsResponse(data)
    return data
  }, [applyItemsResponse, requestJson])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    pollingRef.current = window.setInterval(async () => {
      try {
        const data = await refresh()
        const active = Boolean(
          data.queueActive ||
            (data.items || []).some((item) => item.status === "running" || item.status === "queued")
        )
        if (!active) stopPolling()
      } catch (error) {
        console.error(error)
        setAlertMsg(error instanceof Error ? error.message : "Error de conexión")
        setAlertType("error")
      }
    }, 1000)
  }, [refresh, stopPolling])

  useEffect(() => {
    refresh().catch((error) => {
      setAlertMsg(error instanceof Error ? error.message : "No se pudo conectar con el compresor")
      setAlertType("error")
    })
    return () => stopPolling()
  }, [refresh, stopPolling])

  const active = queueActive || items.some((item) => item.status === "running" || item.status === "queued")
  const hasItems = items.length > 0

  const showAlert = (message: string, type: "error" | "info" = "error") => {
    setAlertMsg(message)
    setAlertType(type)
  }

  const handleUploadClick = () => {
    if (active || uploading) return
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList?.length) return

    const selected = Array.from(fileList)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 30 * 60 * 1000)

    setUploading(true)
    showAlert("")

    try {
      let uploaded = 0
      for (let i = 0; i < selected.length; i += 1) {
        const file = selected[i]
        setUploadStatus(
          selected.length > 1
            ? `Subiendo ${i + 1}/${selected.length}: ${file.name}`
            : `Subiendo: ${file.name}`
        )
        const result = await uploadOneVideo(file, controller.signal)
        uploaded += Number(result.uploaded || 0)
      }

      setUploadStatus("Registrando videos en el compresor…")
      const data = await requestJson("/api/compresor-video/scan", { method: "POST", body: "{}" })
      applyItemsResponse(data)

      if (uploaded === 0 || !(data.items || []).length) {
        showAlert("Los archivos se guardaron pero no aparecieron en la cola. Use «Escanear carpeta».", "info")
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        showAlert("La subida tardó demasiado. Pruebe con menos videos o archivos más pequeños.")
      } else {
        showAlert(error instanceof Error ? error.message : "Error al subir videos")
      }
    } finally {
      window.clearTimeout(timeoutId)
      setUploading(false)
      setUploadStatus("")
      event.target.value = ""
    }
  }

  const handleScanInput = async () => {
    setUploading(true)
    setUploadStatus("Escaneando carpeta input…")
    showAlert("")
    try {
      const data = await requestJson("/api/compresor-video/scan", { method: "POST", body: "{}" })
      applyItemsResponse(data)
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "No se pudo escanear la carpeta")
    } finally {
      setUploading(false)
      setUploadStatus("")
    }
  }

  const handleStart = () => {
    showAlert("")
    setModalError("")
    setLms("")
    setCourseId("")
    setModalOpen(true)
  }

  const handleConfirmOptimize = async () => {
    if (!isValidLms(lms)) {
      setModalError("Selecciona una opción de LMS.")
      return
    }
    if (!/^\d+$/.test(courseId.trim())) {
      setModalError("Ingresa un ID de curso numérico.")
      return
    }

    setConfirming(true)
    setModalError("")
    try {
      const data = await requestJson("/api/compresor-video/start", {
        method: "POST",
        body: JSON.stringify({ resolution, lms, courseId: courseId.trim() }),
      })
      setModalOpen(false)
      applyItemsResponse(data)
      if (data.warning) showAlert(data.warning, "info")
      startPolling()
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No se pudo iniciar")
    } finally {
      setConfirming(false)
    }
  }

  const handleOpenOutput = async () => {
    showAlert("")
    try {
      await requestJson("/api/compresor-video/open-output", { method: "POST", body: "{}" })
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "No se pudo abrir la carpeta")
    }
  }

  const handleStop = async () => {
    showAlert("")
    try {
      const data = await requestJson("/api/compresor-video/stop", { method: "POST", body: "{}" })
      applyItemsResponse(data)
      startPolling()
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "No se pudo detener")
    }
  }

  const handleRemove = async (id: string) => {
    showAlert("")
    try {
      const data = await requestJson("/api/compresor-video/remove", {
        method: "POST",
        body: JSON.stringify({ id }),
      })
      applyItemsResponse(data)
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "No se pudo quitar el video")
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="compresor-video-page">
          <div className="shell">
            <header className="topbar">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Clapperboard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1>Compresor de videos MP4</h1>
                  <p className="subtitle">
                    Optimiza videos y genera paquetes ZIP listos para cargar en Moodle (solo Windows).
                  </p>
                </div>
              </div>
            </header>

            <section className="controls" aria-label="Controles de optimización">
              <div className="control-group">
                <label>Resolución</label>
                <div className="segmented" role="group" aria-label="Resolución">
                  <button
                    className={`segment ${resolution === 720 ? "active" : ""}`}
                    type="button"
                    onClick={() => setResolution(720)}
                  >
                    720p
                  </button>
                  <button
                    className={`segment ${resolution === 480 ? "active" : ""}`}
                    type="button"
                    onClick={() => setResolution(480)}
                  >
                    480p
                  </button>
                </div>
              </div>

              <div className="actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,.mp4"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <button
                  className="button primary"
                  type="button"
                  disabled={active || uploading}
                  onClick={handleUploadClick}
                >
                  {uploading ? uploadStatus || "Subiendo…" : "Agregar videos"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={active || uploading}
                  onClick={handleScanInput}
                >
                  Escanear carpeta
                </button>
                <button
                  className="button success"
                  type="button"
                  disabled={active || !hasItems}
                  onClick={handleStart}
                >
                  Optimizar
                </button>
                <button className="button secondary" type="button" onClick={handleOpenOutput}>
                  Carpeta de salida
                </button>
              </div>
            </section>

            {alertMsg ? (
              <section className="alert" role="alert" data-type={alertType}>
                {alertMsg}
              </section>
            ) : null}

            <section className="queue" aria-label="Videos seleccionados">
              <div className="queue-head">
                <div>
                  <h2>Videos seleccionados</h2>
                  <p className="queue-help">
                    Sube videos MP4, elige la resolución y genera el paquete final para el LMS.
                  </p>
                </div>
                <span>{items.length} {items.length === 1 ? "archivo" : "archivos"}</span>
              </div>

              {queueActive || queueElapsedSeconds > 0 ? (
                <div className="queue-timer">
                  Tiempo total: {formatDuration(queueElapsedSeconds)}
                </div>
              ) : null}

              {!hasItems ? (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    MP4
                  </div>
                  <h3>Aún no hay videos seleccionados</h3>
                  <p>Agrega uno o varios videos MP4 desde tu PC para comenzar.</p>
                </div>
              ) : (
                <div className="video-list">
                  {items.map((item) => {
                    const progress = Math.max(0, Math.min(100, Number(item.progress || 0)))
                    const isRunning = item.status === "running"
                    const zipName =
                      item.zipName || (item.output ? item.output.split(/[\\/]/).pop() : "")
                    const lmsInfo =
                      item.lmsLabel && item.courseId
                        ? `${item.lmsLabel} - curso ${item.courseId}`
                        : "-"
                    const elapsed = formatDuration(item.elapsedSeconds)
                    const total = item.finishedAt ? `Tiempo total: ${elapsed}` : elapsed

                    return (
                      <article key={item.id} className="video-item">
                        <div className="video-main">
                          <div className="video-name" title={item.name}>
                            {item.name}
                          </div>
                          <span className="source-pill">{item.sourceLabel || "Subido desde la web"}</span>
                          <div className="video-meta">
                            {formatBytes(item.size)} - destino {item.resolution || resolution}p
                          </div>
                          <div className="video-meta">{item.message || "Pendiente."}</div>
                        </div>
                        <div className="progress-wrap" aria-label="Progreso">
                          <div className={`progress-track ${item.status}`}>
                            <div className="progress-bar" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="video-meta">
                            {progress}% - {total}
                          </div>
                        </div>
                        <div className="video-stats">
                          <span>
                            <strong>Estado:</strong>{" "}
                            <span className={`video-state ${item.status}`}>
                              {statusLabel(item.status)}
                            </span>
                          </span>
                          <span>
                            <strong>Peso ZIP:</strong> {item.finalSize ? formatBytes(item.finalSize) : "-"}
                          </span>
                          <span>
                            <strong>Reducción:</strong>{" "}
                            {typeof item.reductionPercent === "number"
                              ? `${item.reductionPercent.toFixed(1)}%`
                              : "-"}
                          </span>
                          <span>
                            <strong>LMS:</strong> {lmsInfo}
                          </span>
                          <span className="zip-line">
                            <strong>ZIP generado:</strong>{" "}
                            <span className="zip-name" title={zipName || ""}>
                              {zipName || "-"}
                            </span>
                          </span>
                        </div>
                        <div className="video-actions">
                          {isRunning ? (
                            <button
                              className="stop-video-btn"
                              type="button"
                              onClick={() => handleStop(item.id)}
                            >
                              Detener
                            </button>
                          ) : null}
                          <button
                            className="remove-btn"
                            type="button"
                            title="Quitar"
                            disabled={isRunning}
                            onClick={() => handleRemove(item.id)}
                          >
                            &times;
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
          onClick={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false)
          }}
        >
          <div className="modal-card">
            <div className="modal-head">
              <h2 id="modalTitle">Selecciona LMS y curso</h2>
              <p>Estos datos se usarán para crear la redirección del paquete ZIP.</p>
            </div>

            <div className="modal-body">
              <div className="field">
                <label htmlFor="lmsSelect">LMS</label>
                <select
                  id="lmsSelect"
                  value={lms}
                  onChange={(e) => setLms(e.target.value)}
                  autoFocus
                >
                  <option value="">Selecciona LMS</option>
                  {LMS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="courseIdInput">ID del curso</label>
                <input
                  id="courseIdInput"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej: 647"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              {modalError ? <p className="modal-error">{modalError}</p> : null}
            </div>

            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="button success"
                type="button"
                disabled={confirming}
                onClick={handleConfirmOptimize}
              >
                {confirming ? "Iniciando…" : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
