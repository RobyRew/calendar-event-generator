import type { CalendarEvent } from '@/types'
import { buildRRule } from './ics-generator'
import { addDaysIn, formatICSDate, formatICSUTC, isUTCZone, isValidTimeZone, wallDateString } from './time'

// "Add to calendar" links for a single event. Times are sent as real UTC instants
// (the old Google link formatted local time and appended a fake "Z"), all-day
// events as dates in the event's zone with an exclusive end, and query values are
// percent-encoded (%20, not "+") so every service decodes spaces the same way.

function query(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
    .join('&')
}

function allDayEnd(event: CalendarEvent): string {
  // Stored all-day ends are exclusive already; guard against a zero-length range.
  const end = new Date(event.endDate) > new Date(event.startDate) ? event.endDate : addDaysIn(event.startDate, 1, event.timezone)
  return end
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const dates = event.allDay
    ? `${formatICSDate(event.startDate, event.timezone)}/${formatICSDate(allDayEnd(event), event.timezone)}`
    : `${formatICSUTC(event.startDate)}/${formatICSUTC(event.endDate)}`
  return `https://calendar.google.com/calendar/render?${query({
    action: 'TEMPLATE',
    text: event.summary,
    dates,
    ctz: !isUTCZone(event.timezone) && isValidTimeZone(event.timezone) ? event.timezone : undefined,
    details: event.description || undefined,
    location: event.location?.text || undefined,
    recur: event.recurrenceRule ? `RRULE:${buildRRule(event.recurrenceRule, event)}` : undefined,
  })}`
}

function outlookParams(event: CalendarEvent): Record<string, string | undefined> {
  return {
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.summary,
    startdt: event.allDay ? wallDateString(event.startDate, event.timezone) : new Date(event.startDate).toISOString(),
    enddt: event.allDay ? wallDateString(allDayEnd(event), event.timezone) : new Date(event.endDate).toISOString(),
    allday: event.allDay ? 'true' : undefined,
    body: event.description || undefined,
    location: event.location?.text || undefined,
  }
}

export function generateOutlookUrl(event: CalendarEvent): string {
  return `https://outlook.live.com/calendar/0/deeplink/compose?${query(outlookParams(event))}`
}

export function generateOffice365Url(event: CalendarEvent): string {
  return `https://outlook.office.com/calendar/0/deeplink/compose?${query(outlookParams(event))}`
}
