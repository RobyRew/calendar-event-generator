import { useMemo } from 'react'
import { useEventStore } from '@/stores/event-store'
import { useAccountStore } from '@/stores/account-store'
import type { CalendarEvent } from '@/types'

/** Which visibility switch an event belongs to: 'local', a calendar id, or 'shared' (single shared events). */
export function visibilityId(event: CalendarEvent, ownCalendarIds: Set<string>): string {
  if (!event.calendarId) return 'local'
  return ownCalendarIds.has(event.calendarId) ? event.calendarId : 'shared'
}

/** Events from every calendar the user has not hidden. */
export function useVisibleEvents(): CalendarEvent[] {
  const events = useEventStore((s) => s.events)
  const hidden = useAccountStore((s) => s.hidden)
  const calendars = useAccountStore((s) => s.calendars)
  return useMemo(() => {
    if (hidden.length === 0) return events
    const own = new Set(calendars.map((c) => c.id))
    const off = new Set(hidden)
    return events.filter((e) => !off.has(visibilityId(e, own)))
  }, [events, hidden, calendars])
}
