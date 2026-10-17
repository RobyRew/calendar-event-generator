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
    deleteEvent: async (calendarId: string, uid: string, recurrenceId = '') => {
      if (h.failServer) throw new Error('offline')
      h.calls.push(`DELETE ${uid}`)
      for (const [k, v] of h.server) if (v.calendarId === calendarId && v.uid === uid && (!recurrenceId || v.recurrenceId === recurrenceId)) h.server.delete(k)
    },
    events: async (calendarId: string) => [...h.server.values()].filter((e) => e.calendarId === calendarId),
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
  h.gate = null
  useEventStore.setState({ events: [], past: [], future: [], loaded: false, syncError: null })
  useAccountStore.setState({ status: 'signedIn', user: { id: 'u', email: null, name: null }, calendars: [{ id: 'cal1', name: 'C', description: '', color: '#007aff', timezone: 'UTC', role: 'owner', ownerName: null }], shared: [] })
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
    expect(h.idb.has('L|')).toBe(false)
    expect(useEventStore.getState().events.some((e) => e.uid === 'L')).toBe(false)
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
})
