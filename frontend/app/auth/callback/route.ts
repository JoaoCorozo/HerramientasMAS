import { NextRequest } from "next/server"
import { proxyToBackend } from "@/lib/proxy-backend"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Callback OIDC registrado en Authentik:
 *   http(s)://herramientaslms.../auth/callback
 * Se reenvía al backend /api/auth/oidc/callback (mismo query: code, state).
 */
export async function GET(request: NextRequest) {
  return proxyToBackend(request, ["auth", "oidc", "callback"])
}
