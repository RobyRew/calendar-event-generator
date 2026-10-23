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
  /** The .ics URL of a subscription calendar (read-only, refreshed by the server); null otherwise. */
  sourceUrl: string | null
  fetchedAt: number | null
  fetchError: string | null
}

export type PrefSection = 'settings' | 'templates' | 'hidden'

export interface PrefEntry {
  value: unknown
  version: number
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
  constructor(readonly status: number, readonly code: string, readonly data: Record<string, unknown> = {}) {
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
  if (!res.ok) throw new ApiError(res.status, data.error ?? `http_${res.status}`, data)
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
  /** Delete an override, or (recurrenceId '') the event with its overrides; masterOnly keeps the overrides. */
  deleteEvent: (calendarId: string, uid: string, recurrenceId = '', masterOnly = false) =>
    request(`/api/calendars/${enc(calendarId)}/events?uid=${enc(uid)}${recurrenceId ? `&recurrenceId=${enc(recurrenceId)}` : ''}${masterOnly ? '&masterOnly=1' : ''}`, { method: 'DELETE' }),
  /** Bulk upsert; with createOnly (moves), a UID the calendar already has is refused with 409 uid_exists. */
  importEvents: (calendarId: string, events: CalendarEvent[], createOnly = false) =>
    request<{ events: CalendarEvent[] }>(`/api/calendars/${enc(calendarId)}/import`, { method: 'POST', body: { events, ...(createOnly ? { createOnly } : {}) } }).then((r) => r.events),
  /** Delete whole events (with their overrides) in one request; masterOnly deletes only the master rows. */
  deleteEvents: (calendarId: string, uids: string[], masterOnly = false) =>
    request<{ deleted: number }>(`/api/calendars/${enc(calendarId)}/delete-events`, { method: 'POST', body: { uids, ...(masterOnly ? { masterOnly } : {}) } }),
  /** Move whole events (by UID, overrides included) to another account calendar. */
  moveEvents: (calendarId: string, uids: string[], targetCalendarId: string) =>
    request<{ events: CalendarEvent[] }>(`/api/calendars/${enc(calendarId)}/move`, { method: 'POST', body: { uids, targetCalendarId } }).then((r) => r.events),
  subscribe: (body: { sourceUrl: string; name?: string; color?: string; timezone?: string }) =>
    request<{ calendar: CloudCalendar }>('/api/calendars', { method: 'POST', body }).then((r) => r.calendar),
  refreshCalendar: (id: string) =>
    request<{ calendar: CloudCalendar | null; ok: boolean; error: string | null }>(`/api/calendars/${enc(id)}/refresh`, { method: 'POST', body: {} }),

  prefs: () => request<{ prefs: Partial<Record<PrefSection, PrefEntry>> }>('/api/prefs').then((r) => r.prefs),
  /** Write a section against the version last seen; a 409 ApiError carries the stored entry in data.entry. */
  putPref: (section: PrefSection, value: unknown, baseVersion: number) =>
    request<{ entry: PrefEntry }>(`/api/prefs/${section}`, { method: 'PUT', body: { value, baseVersion } }).then((r) => r.entry),

  exportUrl: '/api/account/export',
  deleteAccount: () => request('/api/account', { method: 'DELETE', body: { confirm: 'DELETE' } }),
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
