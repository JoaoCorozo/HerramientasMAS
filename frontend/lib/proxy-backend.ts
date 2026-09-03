const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000"

const SKIP_REQUEST_HEADERS = new Set(["host", "connection", "content-length"])
// fetch() ya descomprime el body; no reenviar encoding/length del upstream
const SKIP_RESPONSE_HEADERS = new Set([
  "transfer-encoding",
  "connection",
  "content-encoding",
  "content-length",
])

export async function proxyToBackend(request: Request, pathSegments: string[]) {
  const subPath = pathSegments.join("/")
  const incoming = new URL(request.url)
  const target = `${BACKEND.replace(/\/+$/, "")}/api/${subPath}${incoming.search}`

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (SKIP_REQUEST_HEADERS.has(key.toLowerCase())) return
    headers.set(key, value)
  })

  const hasBody = !["GET", "HEAD"].includes(request.method)
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  }
  if (hasBody) {
    init.body = request.body
    init.duplex = "half"
  }

  const upstream = await fetch(target, init)
  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return
    responseHeaders.append(key, value)
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
