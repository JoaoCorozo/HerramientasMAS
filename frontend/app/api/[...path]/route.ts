import { NextRequest } from "next/server"
import { proxyToBackend } from "@/lib/proxy-backend"

export const runtime = "nodejs"
// Hobby: 60s, Pro: hasta 300s. 600 rompe el deploy en planes estándar de Vercel.
export const maxDuration = 60

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
