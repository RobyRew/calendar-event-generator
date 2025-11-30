/**
 * ICS Generator
 * Generates ICS/iCal files from CalendarEvent objects
 * Supports Apple, Google, and Microsoft specific extensions
 */

import {
  Calendar,
  CalendarEvent,
  Alarm,
  RecurrenceRule,
  TimezoneInfo,
  COMMON_TIMEZONES,
  DEFAULT_PRODID,
} from '@/types';
import { format } from 'date-fns';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Fold long lines according to RFC 5545 (max 75 octets per line)
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const result: string[] = [];
  let remaining = line;
  
  // First line
  result.push(remaining.substring(0, maxLength));
  remaining = remaining.substring(maxLength);
  
  // Continuation lines (start with space)
  while (remaining.length > 0) {
    result.push(' ' + remaining.substring(0, maxLength - 1));
    remaining = remaining.substring(maxLength - 1);
  }
  
  return result.join('\r\n');
}

/**
 * Escape text value for ICS
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Format date for ICS (all-day event)
 */
function formatDate(date: Date): string {
  return format(date, 'yyyyMMdd');
}

/**
 * Format datetime for ICS
 */
function formatDateTime(date: Date, utc: boolean = false): string {
  if (utc) {
    return format(date, "yyyyMMdd'T'HHmmss'Z'");
  }
  return format(date, "yyyyMMdd'T'HHmmss");
}

/**
 * Format duration for ICS (in minutes)
 */
function formatDuration(minutes: number): string {
  const absMinutes = Math.abs(minutes);
  const sign = minutes < 0 ? '-' : '';
  
  const days = Math.floor(absMinutes / (24 * 60));
  const hours = Math.floor((absMinutes % (24 * 60)) / 60);
  const mins = absMinutes % 60;
  
  let result = sign + 'P';
  if (days > 0) result += `${days}D`;
  if (hours > 0 || mins > 0) {
    result += 'T';
    if (hours > 0) result += `${hours}H`;
    if (mins > 0) result += `${mins}M`;
  }
  
  // Handle edge case of 0 minutes
  if (result === 'P' || result === '-P') {
    result += 'T0M';
  }
  
  return result;
}

/**
 * Generate RRULE string
 */
function generateRRule(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.frequency}`];
  
  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }
  if (rule.until) {
    parts.push(`UNTIL=${formatDateTime(rule.until, true)}`);
  }
  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  if (rule.byMonth && rule.byMonth.length > 0) {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  }
  if (rule.bySetPos && rule.bySetPos.length > 0) {
    parts.push(`BYSETPOS=${rule.bySetPos.join(',')}`);
  }
  if (rule.weekStart) {
    parts.push(`WKST=${rule.weekStart}`);
  }
  
  return parts.join(';');
}

/**
 * Generate VTIMEZONE component
 */
function generateTimezone(tzInfo: TimezoneInfo): string[] {
  const lines: string[] = [
    'BEGIN:VTIMEZONE',
    `TZID:${tzInfo.tzid}`,
  ];
  
  // Standard time
  lines.push('BEGIN:STANDARD');
  lines.push(`TZNAME:${tzInfo.standardName || 'STD'}`);
  lines.push(`TZOFFSETFROM:${tzInfo.daylightOffset || tzInfo.standardOffset}`);
  lines.push(`TZOFFSETTO:${tzInfo.standardOffset}`);
  lines.push('DTSTART:19701025T030000');
  if (tzInfo.daylightOffset) {
    lines.push('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  }
  lines.push('END:STANDARD');
  
  // Daylight time (if applicable)
  if (tzInfo.daylightOffset) {
    lines.push('BEGIN:DAYLIGHT');
    lines.push(`TZNAME:${tzInfo.daylightName || 'DST'}`);
    lines.push(`TZOFFSETFROM:${tzInfo.standardOffset}`);
    lines.push(`TZOFFSETTO:${tzInfo.daylightOffset}`);
    lines.push('DTSTART:19700329T020000');
    lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
    lines.push('END:DAYLIGHT');
  }
  
  lines.push('END:VTIMEZONE');
  return lines;
}

/**
 * Generate VALARM component
 */
function generateAlarm(alarm: Alarm): string[] {
  const lines: string[] = ['BEGIN:VALARM'];
  
  lines.push(`ACTION:${alarm.action}`);
  
  // Trigger
  if (alarm.triggerType === 'ABSOLUTE') {
    lines.push(`TRIGGER;VALUE=DATE-TIME:${formatDateTime(new Date(alarm.triggerValue), true)}`);
  } else {
    const isNegative = alarm.triggerType === 'BEFORE_START' || alarm.triggerType === 'BEFORE_END';
    const duration = formatDuration(isNegative ? -alarm.triggerValue : alarm.triggerValue);
    const related = alarm.triggerType.includes('END') ? ';RELATED=END' : '';
    lines.push(`TRIGGER${related}:${duration}`);
  }
  
  if (alarm.description) {
    lines.push(`DESCRIPTION:${escapeText(alarm.description)}`);
  }
  
  if (alarm.summary) {
    lines.push(`SUMMARY:${escapeText(alarm.summary)}`);
  }
  
  if (alarm.repeat) {
    lines.push(`REPEAT:${alarm.repeat}`);
    if (alarm.duration) {
      lines.push(`DURATION:${formatDuration(alarm.duration)}`);
    }
  }
  
  lines.push('END:VALARM');
  return lines;
}

/**
 * Generate VEVENT component
 */
function generateEvent(event: CalendarEvent): string[] {
  const lines: string[] = ['BEGIN:VEVENT'];
  
  // Required properties
  lines.push(`UID:${event.uid}`);
  lines.push(`DTSTAMP:${formatDateTime(event.lastModified || new Date(), true)}`);
  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  
  // Date/Time
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(event.endDate)}`);
  } else if (event.timezone) {
    lines.push(`DTSTART;TZID=${event.timezone}:${formatDateTime(event.startDate)}`);
    lines.push(`DTEND;TZID=${event.timezone}:${formatDateTime(event.endDate)}`);
  } else {
    lines.push(`DTSTART:${formatDateTime(event.startDate, true)}`);
    lines.push(`DTEND:${formatDateTime(event.endDate, true)}`);
  }
  
  // Optional properties
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location.text)}`);
    if (event.location.geo) {
      lines.push(`GEO:${event.location.geo.latitude};${event.location.geo.longitude}`);
    }
  }
  
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  
  if (event.status) {
    lines.push(`STATUS:${event.status}`);
  }
  
  if (event.classification) {
    lines.push(`CLASS:${event.classification}`);
  }
  
  if (event.transparency) {
    lines.push(`TRANSP:${event.transparency}`);
  }
  
  if (event.categories && event.categories.length > 0) {
    lines.push(`CATEGORIES:${event.categories.join(',')}`);
  }
  
  if (event.priority) {
    lines.push(`PRIORITY:${event.priority}`);
  }
  
  if (event.sequence !== undefined) {
    lines.push(`SEQUENCE:${event.sequence}`);
  }
  
  if (event.created) {
    lines.push(`CREATED:${formatDateTime(event.created, true)}`);
  }
  
  // Recurrence
  if (event.recurrenceRule) {
    lines.push(`RRULE:${generateRRule(event.recurrenceRule)}`);
  }
  
  // Organizer
  if (event.organizer) {
    let orgLine = 'ORGANIZER';
    if (event.organizer.name) {
      orgLine += `;CN="${event.organizer.name}"`;
    }
    if (event.organizer.directory) {
      orgLine += `;DIR="${event.organizer.directory}"`;
    }
    orgLine += `:mailto:${event.organizer.email}`;
    lines.push(orgLine);
  }
  
  // Attendees
  if (event.attendees) {
    for (const attendee of event.attendees) {
      let attLine = 'ATTENDEE';
      if (attendee.name) {
        attLine += `;CN="${attendee.name}"`;
      }
      attLine += `;ROLE=${attendee.role}`;
      attLine += `;PARTSTAT=${attendee.participationStatus}`;
      if (attendee.rsvp !== undefined) {
        attLine += `;RSVP=${attendee.rsvp ? 'TRUE' : 'FALSE'}`;
      }
      attLine += `:mailto:${attendee.email}`;
      lines.push(attLine);
    }
  }
  
  // Microsoft extensions
  if (event.microsoftExtensions) {
    if (event.microsoftExtensions.busyStatus) {
      lines.push(`X-MICROSOFT-CDO-BUSYSTATUS:${event.microsoftExtensions.busyStatus}`);
    }
    if (event.microsoftExtensions.importance) {
      lines.push(`X-MICROSOFT-CDO-IMPORTANCE:${event.microsoftExtensions.importance}`);
    }
    if (event.microsoftExtensions.allDayEvent !== undefined) {
      lines.push(`X-MICROSOFT-CDO-ALLDAYEVENT:${event.microsoftExtensions.allDayEvent ? 'TRUE' : 'FALSE'}`);
    }
  }
  
  // Apple extensions
  if (event.appleExtensions) {
    if (event.appleExtensions.creatorIdentity) {
      lines.push(`X-APPLE-CREATOR-IDENTITY:${event.appleExtensions.creatorIdentity}`);
    }
    if (event.appleExtensions.travelAdvisoryBehavior) {
      lines.push(`X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:${event.appleExtensions.travelAdvisoryBehavior}`);
    }
    if (event.appleExtensions.structuredLocation && event.location?.geo) {
      const sl = event.appleExtensions.structuredLocation;
      let slLine = 'X-APPLE-STRUCTURED-LOCATION;VALUE=URI';
      if (sl.radius) {
        slLine += `;X-APPLE-RADIUS=${sl.radius}`;
      }
      slLine += `;X-TITLE="${escapeText(sl.title)}"`;
      slLine += `:geo:${event.location.geo.latitude},${event.location.geo.longitude}`;
      lines.push(slLine);
    }
  }
  
  // Alarms
  if (event.alarms) {
    for (const alarm of event.alarms) {
      lines.push(...generateAlarm(alarm));
    }
  }
  
  lines.push('END:VEVENT');
  return lines;
}

// ============================================================
// MAIN GENERATOR
// ============================================================

export interface GeneratorOptions {
  /** Product ID to use in the calendar */
  prodId?: string;
  /** Include timezone definition */
  includeTimezone?: boolean;
  /** Target platform for optimizations */
  targetPlatform?: 'apple' | 'google' | 'microsoft' | 'generic';
  /** Calendar method (PUBLISH, REQUEST, REPLY, CANCEL) */
  method?: string;
}

/**
 * Generate ICS content from a Calendar object
 */
export function generateICS(calendar: Calendar, options: GeneratorOptions = {}): string {
  const lines: string[] = [];
  
  // Calendar header
  lines.push('BEGIN:VCALENDAR');
  lines.push(`VERSION:${calendar.version || '2.0'}`);
  lines.push(`PRODID:${options.prodId || calendar.prodId || DEFAULT_PRODID}`);
  lines.push(`CALSCALE:${calendar.calscale || 'GREGORIAN'}`);
  
  if (options.method || calendar.method) {
    lines.push(`METHOD:${options.method || calendar.method}`);
  }
  
  if (calendar.name) {
    lines.push(`X-WR-CALNAME:${escapeText(calendar.name)}`);
  }
  
  if (calendar.description) {
    lines.push(`X-WR-CALDESC:${escapeText(calendar.description)}`);
  }
  
  // Timezone
  if (options.includeTimezone !== false) {
    // Collect all timezones used in events
    const timezones = new Set<string>();
    for (const event of calendar.events) {
      if (event.timezone) {
        timezones.add(event.timezone);
      }
    }
    
    // Generate timezone components
    for (const tzid of timezones) {
      const tzInfo = calendar.timezone?.tzid === tzid 
        ? calendar.timezone 
        : COMMON_TIMEZONES[tzid];
      
      if (tzInfo) {
        lines.push(...generateTimezone(tzInfo));
      }
    }
  }
  
  // Events
  for (const event of calendar.events) {
    lines.push(...generateEvent(event));
  }
  
  lines.push('END:VCALENDAR');
  
  // Fold lines and join with CRLF
  return lines.map(foldLine).join('\r\n');
}

/**
 * Generate ICS content from a single event
 */
export function generateEventICS(event: CalendarEvent, options: GeneratorOptions = {}): string {
  const calendar: Calendar = {
    prodId: options.prodId || DEFAULT_PRODID,
    version: '2.0',
    calscale: 'GREGORIAN',
    method: options.method || 'PUBLISH',
    events: [event],
  };
  
  return generateICS(calendar, options);
}

/**
 * Download ICS file
 */
export function downloadICS(content: string, filename: string = 'event.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams();
  
  params.set('action', 'TEMPLATE');
  params.set('text', event.summary);
  
  if (event.allDay) {
    params.set('dates', `${formatDate(event.startDate)}/${formatDate(event.endDate)}`);
  } else {
    const start = formatDateTime(event.startDate, true).replace(/[-:]/g, '');
    const end = formatDateTime(event.endDate, true).replace(/[-:]/g, '');
    params.set('dates', `${start}/${end}`);
  }
  
  if (event.description) {
    params.set('details', event.description);
  }
  
  if (event.location?.text) {
    params.set('location', event.location.text);
  }
  
  if (event.recurrenceRule) {
    params.set('recur', `RRULE:${generateRRule(event.recurrenceRule)}`);
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook.com calendar URL
 */
export function generateOutlookUrl(event: CalendarEvent): string {
  const params = new URLSearchParams();
  
  params.set('path', '/calendar/action/compose');
  params.set('rru', 'addevent');
  params.set('subject', event.summary);
  
  if (event.allDay) {
    params.set('startdt', event.startDate.toISOString().split('T')[0]);
    params.set('enddt', event.endDate.toISOString().split('T')[0]);
    params.set('allday', 'true');
  } else {
    params.set('startdt', event.startDate.toISOString());
    params.set('enddt', event.endDate.toISOString());
  }
  
  if (event.description) {
    params.set('body', event.description);
  }
  
  if (event.location?.text) {
    params.set('location', event.location.text);
  }
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Office 365 calendar URL
 */
export function generateOffice365Url(event: CalendarEvent): string {
  const params = new URLSearchParams();
  
  params.set('path', '/calendar/action/compose');
  params.set('rru', 'addevent');
  params.set('subject', event.summary);
  
  if (event.allDay) {
    params.set('startdt', event.startDate.toISOString().split('T')[0]);
    params.set('enddt', event.endDate.toISOString().split('T')[0]);
    params.set('allday', 'true');
  } else {
    params.set('startdt', event.startDate.toISOString());
    params.set('enddt', event.endDate.toISOString());
  }
  
  if (event.description) {
    params.set('body', event.description);
  }
  
  if (event.location?.text) {
    params.set('location', event.location.text);
  }
  
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate Yahoo Calendar URL
 */
export function generateYahooCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams();
  
  params.set('v', '60');
  params.set('title', event.summary);
  
  if (event.allDay) {
    params.set('st', formatDate(event.startDate));
    params.set('et', formatDate(event.endDate));
    params.set('dur', 'allday');
  } else {
    params.set('st', formatDateTime(event.startDate, true));
    params.set('et', formatDateTime(event.endDate, true));
  }
  
  if (event.description) {
    params.set('desc', event.description);
  }
  
  if (event.location?.text) {
    params.set('in_loc', event.location.text);
  }
  
  return `https://calendar.yahoo.com/?${params.toString()}`;
}
