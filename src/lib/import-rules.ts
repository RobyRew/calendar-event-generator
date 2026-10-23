import type { CalendarEvent } from '@/types'

/** ICS stores LAST-MODIFIED to the second; comparing milliseconds made every re-import look modified. */
function sameVersion(a: CalendarEvent, b: CalendarEvent): boolean {
  const secs = (iso: string) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : 0)
  return a.sequence === b.sequence && secs(a.lastModified) === secs(b.lastModified)
}

/**
 * Whether an imported event is the version already stored. The server stamps its
 * own LAST-MODIFIED on every write, so for an account calendar only SEQUENCE can
 * tell; comparing times there made every re-import look modified and duplicated
 * it under new UIDs.
 */
export function isUnchangedDuplicate(existing: CalendarEvent, incoming: CalendarEvent, accountTarget: boolean): boolean {
  return accountTarget ? incoming.sequence <= existing.sequence : sameVersion(existing, incoming)
}
