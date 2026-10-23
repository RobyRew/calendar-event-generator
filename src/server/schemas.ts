import { z } from 'zod'

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const calendarInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  color: color.optional(),
  timezone: z.string().max(64).optional(),
})

export const calendarPatch = calendarInput.partial()

/** POST /api/calendars with sourceUrl: a subscription to an external .ics URL (name optional, taken from the feed). */
export const subscriptionInput = z.object({
  sourceUrl: z.string().trim().min(1).max(2048),
  name: z.string().trim().max(120).optional(),
  color: color.optional(),
  timezone: z.string().max(64).optional(),
})

export const moveInput = z.object({
  uids: z.array(z.string().min(1).max(255)).min(1).max(500),
  targetCalendarId: z.string().min(1).max(64),
})

export const prefPut = z.object({
  value: z.unknown(),
  baseVersion: z.number().int().min(0),
})

/** DELETE /api/account: the user types DELETE to confirm. */
export const accountDelete = z.object({ confirm: z.literal('DELETE') })

const weekday = z.enum(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])
const intList = z.array(z.number().int()).max(400)

const recurrenceRule = z.looseObject({
  frequency: z.enum(['SECONDLY', 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().int().min(1).max(10_000).optional(),
  count: z.number().int().min(1).max(100_000).optional(),
  until: z.iso.datetime({ offset: true }).optional(),
  byDay: z.array(z.string().regex(/^[+-]?\d{0,2}(SU|MO|TU|WE|TH|FR|SA)$/)).max(60).optional(),
  byMonthDay: intList.optional(),
  byMonth: intList.optional(),
  bySetPos: intList.optional(),
  byYearDay: intList.optional(),
  byWeekNo: intList.optional(),
  byHour: intList.optional(),
  byMinute: intList.optional(),
  bySecond: intList.optional(),
  weekStart: weekday.optional(),
})

// The rest of the event shape is validated loosely here and then normalised and
// filtered to known fields by toStoredEvent() (src/server/repo.ts) before it is
// stored. Enumerated fields are checked here and again in normalizeEvent, since
// they are written into ICS lines as they are.
export const eventInput = z.looseObject({
  status: z.enum(['TENTATIVE', 'CONFIRMED', 'CANCELLED']).optional(),
  classification: z.enum(['PUBLIC', 'PRIVATE', 'CONFIDENTIAL']).optional(),
  transparency: z.enum(['OPAQUE', 'TRANSPARENT']).optional(),
  recurrenceRule: recurrenceRule.nullable().optional(),
  uid: z.string().min(1).max(255).regex(/^[^\r\n]+$/),
  recurrenceId: z.string().max(64).optional(),
  summary: z.string().max(2000).optional(),
  description: z.string().max(50_000).optional(),
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }),
  timezone: z.string().max(64).optional(),
  allDay: z.boolean().optional(),
})

export const importInput = z.object({
  events: z.array(eventInput).max(5000),
  /** Moves use this: refuse (409 uid_exists) instead of overwriting an event the calendar already has. */
  createOnly: z.boolean().optional(),
})

export const permission = z.enum(['busy', 'limited', 'full', 'edit'])

export const shareInput = z.object({
  calendarId: z.string().min(1).max(64),
  eventUid: z.string().min(1).max(255).nullable().optional(),
  permission,
  label: z.string().trim().max(120).optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
})

export const sharePatch = z.object({
  label: z.string().trim().max(120).optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
})
