import { format } from 'date-fns'
import type { CalendarEvent } from '@/types'

function formatGoogleDate(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  if (allDay) return format(d, 'yyyyMMdd')
  return format(d, "yyyyMMdd'T'HHmmss'Z'")
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams()
  params.set('action', 'TEMPLATE')
  params.set('text', event.summary)
  params.set('dates', `${formatGoogleDate(event.startDate, event.allDay)}/${formatGoogleDate(event.endDate, event.allDay)}`)
  if (event.description) params.set('details', event.description)
  if (event.location?.text) params.set('location', event.location.text)
  if (event.recurrenceRule) {
    const parts = [`FREQ=${event.recurrenceRule.frequency}`]
    if (event.recurrenceRule.interval > 1) parts.push(`INTERVAL=${event.recurrenceRule.interval}`)
    if (event.recurrenceRule.count) parts.push(`COUNT=${event.recurrenceRule.count}`)
    params.set('recur', `RRULE:${parts.join(';')}`)
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function generateOutlookUrl(event: CalendarEvent): string {
  const params = new URLSearchParams()
  params.set('path', '/calendar/action/compose')
  params.set('rru', 'addevent')
  params.set('subject', event.summary)
  params.set('startdt', event.startDate)
  params.set('enddt', event.endDate)
  if (event.description) params.set('body', event.description)
  if (event.location?.text) params.set('location', event.location.text)
  if (event.allDay) params.set('allday', 'true')
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function generateOffice365Url(event: CalendarEvent): string {
  const params = new URLSearchParams()
  params.set('path', '/calendar/action/compose')
  params.set('rru', 'addevent')
  params.set('subject', event.summary)
  params.set('startdt', event.startDate)
  params.set('enddt', event.endDate)
  if (event.description) params.set('body', event.description)
  if (event.location?.text) params.set('location', event.location.text)
  if (event.allDay) params.set('allday', 'true')
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`
}
