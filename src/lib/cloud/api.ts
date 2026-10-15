import type { CalendarEvent } from '@/types'
import type { SubscribeLinks } from '@/lib/subscribe-links'

/** Accounts, cloud calendars and sharing exist only in the server build. */
export const CLOUD = import.meta.env.PUBLIC_CLOUD === 'true'

export type Role = 'owner' | 'editor' | 'viewer'
export type Permission = 'busy' | 'limited' | 'full' | 'edit'

export interface Me {
  available: boolean
  signedIn: boolean
  user: { id: string; email: string | null; name: string | null } | null
}

export interface CloudCalendar {
  id: string
  name: string
  description: string
  color: string
  timezone: string
  role: Role
  ownerName: string | null
}

export interface Share {
  id: string
  permission: Permission
  label: string
  eventUid: string | null
  personal: boolean
  createdAt: number
  expiresAt: number | null
  lastAccessedAt: number | null
  accessCount: number
  links: SubscribeLinks
}

export interface Member {
  userId: string
  name: string | null
  email: string | null
  role: 'editor' | 'viewer'
  scope: 'calendar' | 'event'
  eventUid: string | null
}

export interface SharedEntry {
  calendarId: string
  calendarName: string
  uid: string
  role: 'editor' | 'viewer'
  events: CalendarEvent[]
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code)
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `http_${res.status}`)
  return data as T
}

const enc = encodeURIComponent

export const api = {
  me: () => request<Me>('/api/me'),
  signInUrl: (returnTo = '/') => `/api/auth/sign-in?returnTo=${enc(returnTo)}`,

  calendars: () => request<{ calendars: CloudCalendar[] }>('/api/calendars').then((r) => r.calendars),
  createCalendar: (body: { name: string; color?: string; timezone?: string; description?: string }) =>
    request<{ calendar: CloudCalendar }>('/api/calendars', { method: 'POST', body }).then((r) => r.calendar),
  updateCalendar: (id: string, body: Partial<Pick<CloudCalendar, 'name' | 'color' | 'timezone' | 'description'>>) =>
    request<{ calendar: CloudCalendar }>(`/api/calendars/${enc(id)}`, { method: 'PATCH', body }).then((r) => r.calendar),
  deleteCalendar: (id: string) => request(`/api/calendars/${enc(id)}`, { method: 'DELETE' }),

  events: (calendarId: string) =>
    request<{ events: CalendarEvent[] }>(`/api/calendars/${enc(calendarId)}/events`).then((r) => r.events),
  putEvent: (calendarId: string, event: CalendarEvent) =>
    request<{ event: CalendarEvent }>(`/api/calendars/${enc(calendarId)}/events`, { method: 'PUT', body: event }).then((r) => r.event),
  deleteEvent: (calendarId: string, uid: string, recurrenceId = '') =>
    request(`/api/calendars/${enc(calendarId)}/events?uid=${enc(uid)}${recurrenceId ? `&recurrenceId=${enc(recurrenceId)}` : ''}`, { method: 'DELETE' }),
  importEvents: (calendarId: string, events: CalendarEvent[]) =>
    request<{ events: CalendarEvent[] }>(`/api/calendars/${enc(calendarId)}/import`, { method: 'POST', body: { events } }).then((r) => r.events),
  shared: () => request<{ shared: SharedEntry[] }>('/api/shared').then((r) => r.shared),

  members: (calendarId: string) => request<{ members: Member[] }>(`/api/calendars/${enc(calendarId)}/members`).then((r) => r.members),
  removeMember: (calendarId: string, userId: string, eventUid?: string | null) =>
    request(`/api/calendars/${enc(calendarId)}/members?userId=${enc(userId)}${eventUid ? `&eventUid=${enc(eventUid)}` : ''}`, { method: 'DELETE' }),

  shares: (calendarId: string, eventUid?: string | null) =>
    request<{ shares: Share[]; role: Role }>(`/api/shares?calendarId=${enc(calendarId)}${eventUid ? `&eventUid=${enc(eventUid)}` : ''}`),
  createShare: (body: { calendarId: string; eventUid?: string | null; permission: Permission; label?: string; expiresAt?: number | null }) =>
    request<{ share: Share }>('/api/shares', { method: 'POST', body }).then((r) => r.share),
  updateShare: (id: string, body: { label?: string; expiresAt?: number | null }) =>
    request<{ share: Share }>(`/api/shares/${enc(id)}`, { method: 'PATCH', body }).then((r) => r.share),
  revokeShare: (id: string) => request(`/api/shares/${enc(id)}`, { method: 'DELETE' }),
  rotateShare: (id: string) => request<{ share: Share }>(`/api/shares/${enc(id)}/rotate`, { method: 'POST', body: {} }).then((r) => r.share),
}
