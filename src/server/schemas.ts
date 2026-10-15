import { z } from 'zod'

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const calendarInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  color: color.optional(),
  timezone: z.string().max(64).optional(),
})

export const calendarPatch = calendarInput.partial()

// The event shape is validated loosely here and then normalised and filtered to
// known fields by toStoredEvent() (src/server/repo.ts) before it is stored.
export const eventInput = z.looseObject({
  uid: z.string().min(1).max(255).regex(/^[^\r\n]+$/),
  recurrenceId: z.string().max(64).optional(),
  summary: z.string().max(2000).optional(),
  description: z.string().max(50_000).optional(),
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }),
  timezone: z.string().max(64).optional(),
  allDay: z.boolean().optional(),
})

export const importInput = z.object({ events: z.array(eventInput).max(5000) })

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
