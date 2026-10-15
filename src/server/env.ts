// Runtime configuration (read on use, so builds do not need production secrets).

export function publicOrigin(): string {
  return (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

export interface LogtoEnv {
  endpoint: string
  appId: string
  appSecret: string
}

/** Logto settings, or null when not configured (accounts are then unavailable, the app still runs). */
export function logtoEnv(): LogtoEnv | null {
  const endpoint = process.env.LOGTO_ENDPOINT
  const appId = process.env.LOGTO_APP_ID
  const appSecret = process.env.LOGTO_APP_SECRET
  if (!endpoint || !appId || !appSecret) return null
  return { endpoint, appId, appSecret }
}
