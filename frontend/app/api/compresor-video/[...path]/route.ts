import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 600

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000"

async function proxyCompresorRequest(request: NextRequest, pathSegments: string[]) {
  const subPath = pathSegments.join("/")
  const incoming = new URL(request.url)
  const target = `${BACKEND}/api/compresor-video/${subPath}${incoming.search}`

  const headers = new Headers()
  const cookie = request.headers.get("cookie")
  if (cookie) headers.set("cookie", cookie)
  const authorization = request.headers.get("authorization")
  if (authorization) headers.set("authorization", authorization)
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  const contentLength = request.headers.get("content-length")
  if (contentLength) headers.set("content-length", contentLength)

  const hasBody = !["GET", "HEAD"].includes(request.method)
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
  }
  if (hasBody) {
    init.body = request.body
    init.duplex = "half"
  }

  const upstream = await fetch(target, init)
  const responseHeaders = new Headers()
  const upstreamType = upstream.headers.get("content-type")
  if (upstreamType) responseHeaders.set("content-type", upstreamType)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

type RouteContext = { params: Promise<{ path: string[] }> }

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyCompresorRequest(request, path)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
