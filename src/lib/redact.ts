import type { CalendarEvent } from '@/types'

/**
 * How much of an event leaves the app.
 *   full        — everything
 *   no-personal — no organizer, attendees, contact or creator identity
 *                 (the "Strip personal data" export setting)
 *   limited     — title, time, recurrence and status only
 *   busy        — only that the time is taken: title replaced, nothing else
 * Used by file export and by the subscription feeds (one implementation, so a
 * share link and a downloaded file at the same level carry the same fields).
 */
export type RedactLevel = 'full' | 'no-personal' | 'limited' | 'busy'

export interface RedactOptions {
  /** Title used for busy-level events. */
  busyLabel?: string
}

export function redactEvent(event: CalendarEvent, level: RedactLevel, opts: RedactOptions = {}): CalendarEvent {
  if (level === 'full') return event
  const e: CalendarEvent = { ...event, apple: { ...event.apple }, google: { ...event.google }, microsoft: { ...event.microsoft } }

  // no-personal and stricter
  e.organizer = null
  e.attendees = []
  e.contact = ''
  delete e.apple.creatorIdentity
  delete e.apple.creatorTeamIdentity
  delete e.microsoft.ownerApptId
  e.sourceFile = ''
  e.sourceCalendar = ''
  if (level === 'no-personal') return e

  // limited and stricter
  e.description = ''
  e.comment = ''
  e.location = null
  e.url = ''
  e.attachments = []
  e.resources = []
  e.relatedTo = ''
  e.google = {}
  delete e.apple.structuredData
  delete e.apple.structuredLocation
  delete e.apple.endLocation
  delete e.apple.suggestionInfo
  delete e.apple.travelAdvisory
  if (level === 'limited') return e

  // busy
  e.summary = opts.busyLabel ?? 'Busy'
  e.categories = []
  e.color = ''
  e.priority = 0
  e.classification = 'PRIVATE'
  e.transparency = 'OPAQUE'
  e.alarms = []
  e.microsoft = {}
  e.apple = {}
  return e
}

/**
 * Whether an event belongs in a feed at this level. A free/busy view only shows
 * time that is actually taken, so free (TRANSPARENT) and cancelled events are left out.
 */
export function includeAtLevel(event: CalendarEvent, level: RedactLevel): boolean {
  if (level !== 'busy') return true
  return event.transparency !== 'TRANSPARENT' && event.status !== 'CANCELLED'
}
