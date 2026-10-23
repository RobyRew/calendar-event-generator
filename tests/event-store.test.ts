import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '@/types'
import { normalizeEvent } from '@/lib/normalize'

// The store with IndexedDB and the API replaced by in-memory fakes, to check what
// it writes where (pre-push review findings on undo/redo and failed saves).

const h = vi.hoisted(() => ({
  idb: new Map<string, CalendarEvent>(),
  server: new Map<string, CalendarEvent>(),
  calls: [] as string[],
  failServer: false,
  /** Imports allowed before the next one fails (null = no limit). */
  importsLeft: null as number | null,
  gate: null as Promise<void> | null,
}))
const pk = (e: { uid: string; recurrenceId?: string }) => `${e.uid}|${e.recurrenceId || ''}`
const sk = (e: { calendarId?: string; uid: string; recurrenceId?: string }) => `${e.calendarId}/${e.uid}|${e.recurrenceId || ''}`

vi.mock('@/lib/storage', () => ({
  getAllEvents: async () => [...h.idb.values()],
  putEvent: async (e: CalendarEvent) => void h.idb.set(pk(e), e),
  putEvents: async (es: CalendarEvent[]) => es.forEach((e) => h.idb.set(pk(e), e)),
  deleteEvent: async (e: CalendarEvent) => void h.idb.delete(pk(e)),
  deleteEvents: async (es: CalendarEvent[]) => es.forEach((e) => h.idb.delete(pk(e))),
  clearAllEvents: async () => h.idb.clear(),
  replaceAllEvents: async (es: CalendarEvent[]) => {
    h.idb.clear()
    es.forEach((e) => h.idb.set(pk(e), e))
  },
}))

vi.mock('@/lib/cloud/api', () => ({
  CLOUD: true,
  api: {
    putEvent: async (calendarId: string, e: CalendarEvent) => {
      if (h.gate) await h.gate
      if (h.failServer) throw new Error('offline')
      h.calls.push(`PUT ${e.uid}`)
      const saved = { ...e, calendarId }
      h.server.set(sk(saved), saved)
      return saved
    },
    deleteEvent: async (calendarId: string, uid: string, recurrenceId = '', masterOnly = false) => {
      if (h.failServer) throw new Error('offline')
      h.calls.push(`DELETE ${uid}${masterOnly ? ' master' : ''}`)
      for (const [k, v] of h.server) if (v.calendarId === calendarId && v.uid === uid && (recurrenceId || masterOnly ? v.recurrenceId === recurrenceId : true)) h.server.delete(k)
    },
    events: async (calendarId: string) => [...h.server.values()].filter((e) => e.calendarId === calendarId),
    importEvents: async (calendarId: string, events: CalendarEvent[], createOnly = false) => {
      if (h.failServer) throw new Error('offline')
      if (h.importsLeft !== null && h.importsLeft-- <= 0) throw new Error('calendar_full')
      if (createOnly && [...h.server.values()].some((v) => v.calendarId === calendarId && events.some((e) => e.uid === v.uid))) throw new Error('uid_exists')
      h.calls.push(`IMPORT ${calendarId} ${events.length}`)
      return events.map((e) => {
        const saved = { ...e, calendarId }
        h.server.set(sk(saved), saved)
        return saved
      })
    },
    deleteEvents: async (calendarId: string, uids: string[], masterOnly = false) => {
      if (h.failServer) throw new Error('offline')
      h.calls.push(`DELETE-BULK ${calendarId} ${uids.join(',')}${masterOnly ? ' master' : ''}`)
      for (const [k, v] of h.server) if (v.calendarId === calendarId && uids.includes(v.uid) && (!masterOnly || v.recurrenceId === '')) h.server.delete(k)
      return { deleted: uids.length }
    },
    moveEvents: async (calendarId: string, uids: string[], target: string) => {
      if (h.failServer) throw new Error('offline')
      h.calls.push(`MOVE ${calendarId}->${target} ${uids.join(',')}`)
      const moved: CalendarEvent[] = []
      for (const [k, v] of h.server) {
        if (v.calendarId === calendarId && uids.includes(v.uid)) {
          h.server.delete(k)
          const next = { ...v, calendarId: target }
          h.server.set(sk(next), next)
          moved.push(next)
        }
      }
      return moved
    },
  },
}))

const { useEventStore } = await import('@/stores/event-store')
const { useAccountStore } = await import('@/stores/account-store')
const { eventKey } = await import('@/lib/utils')

const cloud = (uid: string, summary = uid) => normalizeEvent({ uid, summary, calendarId: 'cal1', startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z' })
const local = (uid: string) => normalizeEvent({ uid, summary: uid, startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' })

beforeEach(() => {
  h.idb.clear()
  h.server.clear()
  h.calls.length = 0
  h.failServer = false
  h.importsLeft = null
  h.gate = null
  useEventStore.setState({ events: [], past: [], future: [], loaded: false, syncError: null })
  const cal = (id: string, extra = {}) => ({ id, name: id, description: '', color: '#007aff', timezone: 'UTC', role: 'owner' as const, ownerName: null, sourceUrl: null, fetchedAt: null, fetchError: null, ...extra })
  useAccountStore.setState({
    status: 'signedIn',
    user: { id: 'u', email: null, name: null },
    calendars: [cal('cal1'), cal('cal2'), cal('subs', { sourceUrl: 'https://example.org/h.ics' }), cal('theirs', { role: 'viewer' })],
    shared: [],
  })
})

describe('event store', () => {
  it('undo after a refresh brought in account events does not delete them', async () => {
    for (const e of [cloud('A'), cloud('B')]) h.server.set(sk(e), e)
    const s = useEventStore.getState()
    await s.load()
    await s.addEvent(local('L1')) // before the first account sync landed
    await s.loadCloud()
    await useEventStore.getState().undo()
    expect(h.calls).toEqual([])
    expect([...h.server.values()].map((e) => e.uid).sort()).toEqual(['A', 'B'])
  })

  it('undo after another member changed the calendar does not revert or delete their work', async () => {
    h.server.set(sk(cloud('A')), cloud('A'))
    const s = useEventStore.getState()
    await s.load()
    await s.loadCloud()
    await s.addEvent(local('L2'))
    const changed = cloud('A', 'A-collab')
    h.server.set(sk(changed), changed)
    h.server.set(sk(cloud('C')), cloud('C'))
    await useEventStore.getState().loadCloud()
    await useEventStore.getState().undo()
    expect(h.calls).toEqual([])
    expect(h.server.get('cal1/A|')!.summary).toBe('A-collab')
    expect(h.server.has('cal1/C|')).toBe(true)
  })

  it('a refresh that changes nothing keeps undo history and event objects', async () => {
    h.server.set(sk(cloud('A')), cloud('A'))
    await useEventStore.getState().loadCloud()
    await useEventStore.getState().addEvent(local('L3'))
    const before = useEventStore.getState().events.find((e) => e.uid === 'A')
    await useEventStore.getState().loadCloud()
    expect(useEventStore.getState().past).toHaveLength(1)
    expect(useEventStore.getState().events.find((e) => e.uid === 'A')).toBe(before)
  })

  it('a failed undo leaves the device database and the screen in agreement', async () => {
    h.server.set(sk(cloud('A')), cloud('A'))
    await useEventStore.getState().loadCloud()
    await useEventStore.getState().addEvent(local('L'))
    await useEventStore.getState().deleteEvents([eventKey(local('L')), eventKey(cloud('A'))])
    expect(h.idb.has('L|')).toBe(false)
    h.failServer = true
    const ok = await useEventStore.getState().undo()
    expect(ok).toBe(false)
    // The device event comes back before the account step (which failed), and the
    // screen follows IndexedDB: both have it, and the step stays to be retried.
    expect(h.idb.has('L|')).toBe(true)
    expect(useEventStore.getState().events.some((e) => e.uid === 'L')).toBe(true)
    expect(useEventStore.getState().canUndo()).toBe(true)
  })

  it('reports a failed save so the editor can stay open', async () => {
    h.failServer = true
    expect(await useEventStore.getState().addEvent(cloud('X'))).toBe(false)
    h.failServer = false
    expect(await useEventStore.getState().addEvent(cloud('Y'))).toBe(true)
  })

  it('deletes a device event whose UID contains "::"', async () => {
    const odd = local('event::42')
    await useEventStore.getState().addEvent(odd)
    expect(h.idb.has('event::42|')).toBe(true)
    await useEventStore.getState().deleteEvent(eventKey(odd))
    expect(h.idb.has('event::42|')).toBe(false)
  })

  it('a refresh that lands while a save is in flight does not let undo revert other members\' work', async () => {
    for (const e of [cloud('A'), cloud('B')]) h.server.set(sk(e), e)
    await useEventStore.getState().loadCloud()
    let release!: () => void
    h.gate = new Promise((r) => (release = r))
    const saving = useEventStore.getState().updateEvent({ ...cloud('A'), summary: 'A2' })
    // A teammate adds C and edits B; the tab regains focus and refreshes.
    h.server.set(sk(cloud('C')), cloud('C'))
    h.server.set(sk(cloud('B')), cloud('B', 'B-collab'))
    const refreshing = useEventStore.getState().loadCloud()
    release()
    h.gate = null
    await Promise.all([saving, refreshing])
    expect(useEventStore.getState().events.map((e) => e.summary).sort()).toEqual(['A2', 'B-collab', 'C'])
    await useEventStore.getState().undo()
    expect(h.calls.filter((c) => c !== 'PUT A')).toEqual([])
    expect(h.server.has('cal1/C|')).toBe(true)
    expect(h.server.get('cal1/B|')!.summary).toBe('B-collab')
  })

  it('undo of a device delete still works after another member changed the calendar', async () => {
    h.server.set(sk(cloud('A')), cloud('A'))
    await useEventStore.getState().loadCloud()
    await useEventStore.getState().addEvent(local('L'))
    await useEventStore.getState().deleteEvent(eventKey(local('L')))
    h.server.set(sk(cloud('A')), cloud('A', 'A-collab'))
    await useEventStore.getState().loadCloud()
    expect(useEventStore.getState().canUndo()).toBe(true)
    await useEventStore.getState().undo()
    expect(h.idb.has('L|')).toBe(true)
    expect(useEventStore.getState().events.some((e) => e.uid === 'L')).toBe(true)
    expect(h.calls).toEqual([])
    expect(h.server.get('cal1/A|')!.summary).toBe('A-collab')
  })

  it('an account check that fails (offline) keeps the account events on screen', async () => {
    h.server.set(sk(cloud('A')), cloud('A'))
    await useEventStore.getState().loadCloud()
    useAccountStore.setState({ status: 'unavailable' })
    await useEventStore.getState().loadCloud()
    expect(useEventStore.getState().events.map(eventKey)).toEqual([eventKey(cloud('A'))])
    useAccountStore.setState({ status: 'signedOut', calendars: [] })
    await useEventStore.getState().loadCloud()
    expect(useEventStore.getState().events).toEqual([])
  })

  describe('moving and copying', () => {
    const series = (uid: string, calendarId?: string) => [
      normalizeEvent({ uid, calendarId, summary: uid, startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z', recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 3 } }),
      normalizeEvent({ uid, calendarId, recurrenceId: '2026-10-27T07:00:00.000Z', summary: `${uid} moved`, startDate: '2026-10-27T09:00:00.000Z', endDate: '2026-10-27T10:00:00.000Z' }),
    ]

    it('moves a device series into an account calendar, and undo brings it back', async () => {
      for (const e of series('L')) await useEventStore.getState().addEvent(e)
      h.calls.length = 0
      // Selecting only the master takes the override along.
      expect(await useEventStore.getState().moveEvents([eventKey(series('L')[0]!)], 'cal1')).toBe(true)
      expect(h.calls).toEqual(['IMPORT cal1 2'])
      expect(h.idb.size).toBe(0)
      expect([...h.server.keys()].sort()).toEqual(['cal1/L|', 'cal1/L|2026-10-27T07:00:00.000Z'])
      expect(useEventStore.getState().events.every((e) => e.calendarId === 'cal1')).toBe(true)
      h.calls.length = 0
      expect(await useEventStore.getState().undo()).toBe(true)
      // One bulk delete for the series; the server removes the override with its master.
      expect(h.calls).toEqual(['DELETE-BULK cal1 L'])
      expect(h.server.size).toBe(0)
      expect([...h.idb.keys()].sort()).toEqual(['L|', 'L|2026-10-27T07:00:00.000Z'])
    })

    it('moves between account calendars through the move endpoint', async () => {
      for (const e of series('A', 'cal1')) h.server.set(sk(e), e)
      await useEventStore.getState().loadCloud()
      expect(await useEventStore.getState().moveEvents([eventKey(series('A', 'cal1')[1]!)], 'cal2')).toBe(true)
      expect(h.calls).toEqual(['MOVE cal1->cal2 A'])
      expect(useEventStore.getState().events.map((e) => e.calendarId)).toEqual(['cal2', 'cal2'])
    })

    it('moves an account event to this device, deleting it on the server', async () => {
      for (const e of series('A', 'cal1')) h.server.set(sk(e), e)
      await useEventStore.getState().loadCloud()
      expect(await useEventStore.getState().moveEvents([eventKey(series('A', 'cal1')[0]!)], null)).toBe(true)
      expect(h.server.size).toBe(0)
      expect([...h.idb.keys()].sort()).toEqual(['A|', 'A|2026-10-27T07:00:00.000Z'])
      expect(useEventStore.getState().events.every((e) => !e.calendarId)).toBe(true)
    })

    it('a failed delete on the server takes the device copy back out', async () => {
      for (const e of series('A', 'cal1')) h.server.set(sk(e), e)
      await useEventStore.getState().loadCloud()
      h.failServer = true
      expect(await useEventStore.getState().moveEvents([eventKey(series('A', 'cal1')[0]!)], null)).toBe(false)
      expect(h.idb.size).toBe(0)
      expect(h.server.size).toBe(2)
    })

    it('refuses to move events out of a calendar the user cannot write to', async () => {
      for (const id of ['subs', 'theirs']) {
        const e = normalizeEvent({ uid: `x-${id}`, calendarId: id, summary: 'x', startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z' })
        h.server.set(sk(e), e)
      }
      useAccountStore.setState({ calendars: [...useAccountStore.getState().calendars] })
      await useEventStore.getState().loadCloud()
      h.calls.length = 0
      const keys = useEventStore.getState().events.map(eventKey)
      expect(await useEventStore.getState().moveEvents(keys, 'cal1')).toBe(false)
      expect(h.calls).toEqual([])
    })

    it('copies under a new UID and leaves the original in place', async () => {
      for (const e of series('L')) await useEventStore.getState().addEvent(e)
      h.calls.length = 0
      expect(await useEventStore.getState().copyEvents([eventKey(series('L')[0]!)], 'cal1')).toBe(true)
      expect(h.idb.size).toBe(2)
      const copied = [...h.server.values()]
      expect(copied).toHaveLength(2)
      expect(new Set(copied.map((e) => e.uid)).size).toBe(1)
      expect(copied[0]!.uid).not.toBe('L')
      expect(copied.map((e) => e.recurrenceId).sort()).toEqual(['', '2026-10-27T07:00:00.000Z'])
    })

    it('imports into an account calendar in batches that keep each series together', async () => {
      const many = Array.from({ length: 1200 }, (_, i) => series(`s${i}`)).flat() // 2,400 events
      expect(await useEventStore.getState().importToCalendar('cal1', many)).toBe(true)
      const sizes = h.calls.map((c) => Number(c.split(' ')[2]))
      expect(sizes.every((n) => n <= 1000 && n % 2 === 0)).toBe(true)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(2400)
      expect(useEventStore.getState().events.filter((e) => e.calendarId === 'cal1')).toHaveLength(2400)
    })
  })

  describe('review fixes (2026-10-22)', () => {
    const series = (uid: string, calendarId?: string) => [
      normalizeEvent({ uid, calendarId, summary: uid, startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z', recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 3 } }),
      normalizeEvent({ uid, calendarId, recurrenceId: '2026-10-27T07:00:00.000Z', summary: `${uid} moved`, startDate: '2026-10-27T09:00:00.000Z', endDate: '2026-10-27T10:00:00.000Z' }),
    ]
    const st = () => useEventStore.getState()

    it('a move to the account never overwrites an event the calendar already has', async () => {
      const team = normalizeEvent({ uid: 'inv', calendarId: 'cal1', summary: 'agenda notes', startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z' })
      h.server.set(sk(team), team)
      await st().loadCloud()
      await st().addEvent(normalizeEvent({ ...team, calendarId: undefined, summary: 'stale device copy' }))
      h.calls.length = 0
      expect(await st().moveEvents([eventKey({ ...team, calendarId: undefined })], 'cal1')).toBe(false)
      expect(h.calls).toEqual([])
      expect(h.server.get('cal1/inv|')!.summary).toBe('agenda notes')
      expect(h.idb.get('inv|')!.summary).toBe('stale device copy')
    })

    it('a move to the device never overwrites a device event with the same UID', async () => {
      const acc = normalizeEvent({ uid: 'V', calendarId: 'cal1', summary: 'account V', startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z' })
      h.server.set(sk(acc), acc)
      await st().loadCloud()
      await st().addEvent(normalizeEvent({ ...acc, calendarId: undefined, summary: 'my device V' }))
      expect(await st().moveEvents([eventKey(acc)], null)).toBe(false)
      expect(h.idb.get('V|')!.summary).toBe('my device V')
      expect(h.server.has('cal1/V|')).toBe(true)
    })

    it('a failed undo of a device-to-account move loses nothing', async () => {
      for (const e of series('L')) await st().addEvent(e)
      expect(await st().moveEvents([eventKey(series('L')[0]!)], 'cal1')).toBe(true)
      h.failServer = true
      expect(await st().undo()).toBe(false)
      // Back on the device before the account step (which failed): in both places, not in neither.
      expect([...h.idb.keys()].sort()).toEqual(['L|', 'L|2026-10-27T07:00:00.000Z'])
      expect(h.server.size).toBe(2)
    })

    it('undo of an account-to-device move after a teammate\'s change puts the event back in the account', async () => {
      for (const e of [...series('A', 'cal1'), cloud('B')]) h.server.set(sk(e), e)
      await st().loadCloud()
      expect(await st().moveEvents([eventKey(series('A', 'cal1')[0]!)], null)).toBe(true)
      h.server.set(sk(cloud('B')), cloud('B', 'B-collab'))
      await st().loadCloud() // rebases the history
      expect(await st().undo()).toBe(true)
      expect([...h.server.keys()].filter((k) => k.startsWith('cal1/A')).sort()).toEqual(['cal1/A|', 'cal1/A|2026-10-27T07:00:00.000Z'])
      expect(h.idb.size).toBe(0)
      expect(h.server.get('cal1/B|')!.summary).toBe('B-collab')
    })

    it('undo of a device-to-account move after a teammate\'s change takes it out of the account again', async () => {
      h.server.set(sk(cloud('B')), cloud('B'))
      await st().loadCloud()
      for (const e of series('L')) await st().addEvent(e)
      expect(await st().moveEvents([eventKey(series('L')[0]!)], 'cal1')).toBe(true)
      h.server.set(sk(cloud('B')), cloud('B', 'B-collab'))
      await st().loadCloud()
      expect(await st().undo()).toBe(true)
      expect([...h.server.keys()].some((k) => k.startsWith('cal1/L'))).toBe(false)
      expect([...h.idb.keys()].sort()).toEqual(['L|', 'L|2026-10-27T07:00:00.000Z'])
    })

    it('the part of an import that went through gets its own undo step', async () => {
      await st().addEvent(local('previous-step'))
      h.importsLeft = 1
      const many = Array.from({ length: 1200 }, (_, i) => series(`s${i}`)).flat() // 3 batches
      expect(await st().importToCalendar('cal1', many)).toBe(false)
      const imported = h.server.size
      expect(imported).toBeGreaterThan(0)
      h.importsLeft = null
      expect(await st().undo()).toBe(true)
      // Undo removed the imported batch, not the unrelated step before it.
      expect(h.server.size).toBe(0)
      expect(h.idb.has('previous-step|')).toBe(true)
    })

    it('deleting a shared event\'s master and override together sends one delete', async () => {
      useAccountStore.setState({ shared: [{ calendarId: 'theirs', calendarName: 'T', uid: 'S', role: 'editor', events: series('S', 'theirs') }] })
      for (const e of series('S', 'theirs')) h.server.set(sk(e), e)
      await st().loadCloud()
      h.calls.length = 0
      expect(await st().deleteEvents(series('S', 'theirs').map(eventKey))).toBe(true)
      expect(h.calls).toEqual(['DELETE S'])
    })
  })

  it('re-importing the same file into an account calendar is recognised by SEQUENCE', async () => {
    const { isUnchangedDuplicate } = await import('@/lib/import-rules')
    const stored = normalizeEvent({ uid: 'x', sequence: 2, lastModified: '2026-10-22T10:00:00.000Z' })
    const file = normalizeEvent({ uid: 'x', sequence: 2, lastModified: '2026-10-01T08:00:00.000Z' })
    expect(isUnchangedDuplicate(stored, file, true)).toBe(true)
    expect(isUnchangedDuplicate(stored, { ...file, sequence: 3 }, true)).toBe(false)
    expect(isUnchangedDuplicate(stored, file, false)).toBe(false)
  })

  describe('second review fixes (2026-10-22)', () => {
    const ev = (uid: string, calendarId: string | undefined, summary: string) =>
      normalizeEvent({ uid, calendarId, summary, startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z' })
    const st = () => useEventStore.getState()

    it('moving one UID from two calendars to the device stops instead of overwriting the first', async () => {
      for (const e of [ev('V', 'cal1', 'cal1 version'), ev('V', 'cal2', 'cal2 version')]) h.server.set(sk(e), e)
      await st().loadCloud()
      expect(await st().moveEvents(st().events.map(eventKey), null)).toBe(false)
      expect(h.idb.size).toBe(1)
      const kept = [...h.server.values()]
      expect(kept).toHaveLength(1)
      // Whichever came first is on the device; the other one is still in its calendar.
      expect(h.idb.get('V|')!.summary).not.toBe(kept[0]!.summary)
    })

    it('a failed undo of an account-to-account move leaves the event where it is', async () => {
      h.server.set(sk(ev('X', 'cal1', 'X')), ev('X', 'cal1', 'X'))
      await st().loadCloud()
      expect(await st().moveEvents([eventKey(ev('X', 'cal1', 'X'))], 'cal2')).toBe(true)
      h.importsLeft = 0 // writing it back to cal1 fails
      expect(await st().undo()).toBe(false)
      expect([...h.server.keys()]).toEqual(['cal2/X|'])
    })

    it('deleting a device copy of an account event is not treated as a move by the history rebase', async () => {
      h.server.set(sk(ev('E', 'cal1', 'E')), ev('E', 'cal1', 'E'))
      await st().loadCloud()
      await st().addEvent(ev('E', undefined, 'device copy'))
      await st().deleteEvent(eventKey(ev('E', undefined, 'x')))
      h.server.set(sk(ev('E', 'cal1', 'E')), ev('E', 'cal1', 'teammate edit'))
      await st().loadCloud()
      h.calls.length = 0
      expect(await st().undo()).toBe(true)
      expect(h.idb.get('E|')!.summary).toBe('device copy')
      expect(h.server.get('cal1/E|')!.summary).toBe('teammate edit')
      expect(h.calls).toEqual([])
    })
  })

  describe('third review fixes (2026-10-22)', () => {
    const ev = (uid: string, calendarId: string | undefined, summary: string, extra: Record<string, unknown> = {}) =>
      normalizeEvent({ uid, calendarId, summary, startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z', ...extra })
    const st = () => useEventStore.getState()
    const serverKeys = () => [...h.server.keys()].sort()

    it('undo past a move after a refresh keeps the moved event (account to device)', async () => {
      for (const e of [ev('A', 'cal1', 'A'), ev('B', 'cal1', 'B')]) h.server.set(sk(e), e)
      await st().loadCloud()
      await st().addEvent(ev('L', undefined, 'L'))
      await st().updateEvent({ ...st().events.find((e) => e.uid === 'L')!, summary: 'L edited' })
      expect(await st().moveEvents([eventKey(ev('A', 'cal1', 'A'))], null)).toBe(true)
      h.server.set(sk(ev('B', 'cal1', 'B')), ev('B', 'cal1', 'B-collab'))
      await st().loadCloud()
      expect(await st().undo()).toBe(true) // the move
      expect(await st().undo()).toBe(true) // the edit of L
      expect(serverKeys()).toEqual(['cal1/A|', 'cal1/B|'])
      expect(h.idb.has('A|')).toBe(false)
      expect(h.idb.get('L|')!.summary).toBe('L')
    })

    it('undo past a move after a refresh keeps the moved event (device to account)', async () => {
      h.server.set(sk(ev('B', 'cal1', 'B')), ev('B', 'cal1', 'B'))
      await st().loadCloud()
      await st().addEvent(ev('L', undefined, 'L'))
      await st().addEvent(ev('V', undefined, 'V'))
      await st().updateEvent({ ...st().events.find((e) => e.uid === 'L')!, summary: 'L edited' })
      expect(await st().moveEvents([eventKey(ev('V', undefined, 'V'))], 'cal1')).toBe(true)
      h.server.set(sk(ev('B', 'cal1', 'B')), ev('B', 'cal1', 'B-collab'))
      await st().loadCloud()
      expect(await st().undo()).toBe(true)
      expect(await st().undo()).toBe(true)
      expect(serverKeys()).toEqual(['cal1/B|'])
      expect(h.idb.has('V|')).toBe(true)
    })

    it('undo of a move does not revert a teammate\'s edit of the same UID in another calendar', async () => {
      h.server.set(sk(ev('V', 'cal1', 'cal1 V')), ev('V', 'cal1', 'cal1 V'))
      await st().loadCloud()
      await st().addEvent(ev('V', undefined, 'device V'))
      expect(await st().moveEvents([eventKey(ev('V', undefined, 'x'))], 'cal2')).toBe(true)
      h.server.set(sk(ev('V', 'cal1', 'x')), ev('V', 'cal1', 'teammate edit', { sequence: 3 }))
      await st().loadCloud()
      expect(await st().undo()).toBe(true)
      expect(h.server.get('cal1/V|')!.summary).toBe('teammate edit')
      expect(h.server.has('cal2/V|')).toBe(false)
      expect(h.idb.get('V|')!.summary).toBe('device V')
    })

    it('undo of an import over an override without its master keeps that override', async () => {
      const orphan = ev('U', 'cal1', 'updated occurrence', { recurrenceId: '2026-10-27T07:00:00.000Z', startDate: '2026-10-27T09:00:00.000Z', endDate: '2026-10-27T10:00:00.000Z' })
      h.server.set(sk(orphan), orphan)
      await st().loadCloud()
      const master = ev('U', undefined, 'series', { recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 3 } })
      expect(await st().importToCalendar('cal1', [master, { ...orphan, calendarId: undefined, summary: 'changed occurrence' }])).toBe(true)
      expect(await st().undo()).toBe(true)
      expect(serverKeys()).toEqual(['cal1/U|2026-10-27T07:00:00.000Z'])
      expect(h.server.get('cal1/U|2026-10-27T07:00:00.000Z')!.summary).toBe('updated occurrence')
    })
  })

  describe('fourth review fixes (2026-10-24)', () => {
    const ev = (uid: string, calendarId: string | undefined, summary: string, extra: Record<string, unknown> = {}) =>
      normalizeEvent({ uid, calendarId, summary, startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z', ...extra })
    const st = () => useEventStore.getState()

    it('undoing a device-to-account move that was followed by a move to another calendar leaves it only on the device', async () => {
      h.server.set(sk(ev('B', 'cal1', 'B')), ev('B', 'cal1', 'B'))
      h.idb.set('V|', ev('V', undefined, 'V')) // already on the device: no history step for it
      await st().load()
      await st().loadCloud()
      expect(await st().moveEvents([eventKey(ev('V', undefined, 'V'))], 'cal1')).toBe(true)
      expect(await st().moveEvents([eventKey(ev('V', 'cal1', 'V'))], 'cal2')).toBe(true)
      h.server.set(sk(ev('B', 'cal1', 'B')), ev('B', 'cal1', 'B-collab'))
      await st().loadCloud()
      while (st().canUndo()) expect(await st().undo()).toBe(true)
      expect([...h.server.keys()].sort()).toEqual(['cal1/B|'])
      expect(h.idb.has('V|')).toBe(true)
    })

    it('a failed undo of an import over an override without its master deletes nothing', async () => {
      const orphan = ev('U', 'cal1', 'updated occurrence', { recurrenceId: '2026-10-27T07:00:00.000Z', startDate: '2026-10-27T09:00:00.000Z', endDate: '2026-10-27T10:00:00.000Z' })
      h.server.set(sk(orphan), orphan)
      await st().loadCloud()
      const master = ev('U', undefined, 'series', { recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 3 } })
      expect(await st().importToCalendar('cal1', [master, { ...orphan, calendarId: undefined, summary: 'changed occurrence' }])).toBe(true)
      h.importsLeft = 0 // writing the old override back fails
      expect(await st().undo()).toBe(false)
      expect([...h.server.keys()].sort()).toEqual(['cal1/U|', 'cal1/U|2026-10-27T07:00:00.000Z'])
      expect(st().canUndo()).toBe(true)
    })
  })
})
