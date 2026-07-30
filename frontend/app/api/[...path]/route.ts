import { NextRequest } from "next/server"
import { proxyToBackend } from "@/lib/proxy-backend"

export const runtime = "nodejs"
export const maxDuration = 600

type RouteContext = { params: Promise<{ path: string[] }> }

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return proxyToBackend(request, path)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
