/**
 * ICS Parser
 * Parses ICS/iCal files into CalendarEvent objects
 * Supports Apple, Google, and Microsoft specific extensions
 */

import {
  Calendar,
  CalendarEvent,
  Alarm,
  AlarmAction,
  Attendee,
  AttendeeRole,
  AttendeeParticipationStatus,
  EventClass,
  EventStatus,
  GeoLocation,
  RecurrenceRule,
  RecurrenceFrequency,
  TimeTransparency,
  TimezoneInfo,
  WeekDay,
  DEFAULT_CALENDAR,
  DEFAULT_EVENT,
  AppleExtensions,
  MicrosoftExtensions,
} from '@/types';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Unfold ICS lines (remove line continuations)
 */
function unfoldLines(icsContent: string): string[] {
  // Replace CRLF followed by space/tab with nothing
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  return unfolded.split(/\r\n|\n/).filter(line => line.trim() !== '');
}

/**
 * Parse a property line into name, params, and value
 */
function parsePropertyLine(line: string): { name: string; params: Record<string, string>; value: string } {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return { name: line, params: {}, value: '' };
  }

  const beforeColon = line.substring(0, colonIndex);
  const value = line.substring(colonIndex + 1);

  const semicolonIndex = beforeColon.indexOf(';');
  let name: string;
  let paramsStr: string;

  if (semicolonIndex === -1) {
    name = beforeColon;
    paramsStr = '';
  } else {
    name = beforeColon.substring(0, semicolonIndex);
    paramsStr = beforeColon.substring(semicolonIndex + 1);
  }

  const params: Record<string, string> = {};
  if (paramsStr) {
    // Parse parameters (handle quoted values)
    const paramMatches = paramsStr.matchAll(/([^=;]+)=("([^"]*)"|[^;]*)/g);
    for (const match of paramMatches) {
      const paramName = match[1].trim();
      const paramValue = match[3] !== undefined ? match[3] : match[2];
      params[paramName] = paramValue;
    }
  }

  return { name: name.toUpperCase(), params, value };
}

/**
 * Parse ICS datetime string
 */
function parseDateTime(value: string, _tzid?: string): Date {
  // Format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const isUtc = value.endsWith('Z');
  const cleanValue = value.replace('Z', '');
  
  const year = parseInt(cleanValue.substring(0, 4));
  const month = parseInt(cleanValue.substring(4, 6)) - 1;
  const day = parseInt(cleanValue.substring(6, 8));
  
  if (cleanValue.includes('T')) {
    const hour = parseInt(cleanValue.substring(9, 11));
    const minute = parseInt(cleanValue.substring(11, 13));
    const second = parseInt(cleanValue.substring(13, 15)) || 0;
    
    if (isUtc) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }
  
  return new Date(year, month, day);
}

/**
 * Parse ICS date string (all-day event)
 */
function parseDate(value: string): Date {
  const year = parseInt(value.substring(0, 4));
  const month = parseInt(value.substring(4, 6)) - 1;
  const day = parseInt(value.substring(6, 8));
  return new Date(year, month, day);
}

/**
 * Parse duration string (e.g., PT2H, P1D, -PT30M)
 */
function parseDuration(value: string): number {
  const isNegative = value.startsWith('-');
  const cleanValue = value.replace(/^-/, '');
  
  let minutes = 0;
  
  // Match days
  const dayMatch = cleanValue.match(/(\d+)D/);
  if (dayMatch) minutes += parseInt(dayMatch[1]) * 24 * 60;
  
  // Match hours
  const hourMatch = cleanValue.match(/(\d+)H/);
  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
  
  // Match minutes
  const minMatch = cleanValue.match(/(\d+)M/);
  if (minMatch) minutes += parseInt(minMatch[1]);
  
  // Match weeks
  const weekMatch = cleanValue.match(/(\d+)W/);
  if (weekMatch) minutes += parseInt(weekMatch[1]) * 7 * 24 * 60;
  
  return isNegative ? -minutes : minutes;
}

/**
 * Parse GEO property
 */
function parseGeo(value: string): GeoLocation {
  const [lat, lng] = value.split(';').map(v => parseFloat(v));
  return { latitude: lat, longitude: lng };
}

/**
 * Parse RRULE value
 */
function parseRRule(value: string): RecurrenceRule {
  const parts = value.split(';');
  const rule: RecurrenceRule = {
    frequency: 'DAILY',
  };

  for (const part of parts) {
    const [key, val] = part.split('=');
    switch (key) {
      case 'FREQ':
        rule.frequency = val as RecurrenceFrequency;
        break;
      case 'INTERVAL':
        rule.interval = parseInt(val);
        break;
      case 'COUNT':
        rule.count = parseInt(val);
        break;
      case 'UNTIL':
        rule.until = parseDateTime(val);
        break;
      case 'BYDAY':
        rule.byDay = val.split(',') as WeekDay[];
        break;
      case 'BYMONTHDAY':
        rule.byMonthDay = val.split(',').map(v => parseInt(v));
        break;
      case 'BYMONTH':
        rule.byMonth = val.split(',').map(v => parseInt(v));
        break;
      case 'BYSETPOS':
        rule.bySetPos = val.split(',').map(v => parseInt(v));
        break;
      case 'WKST':
        rule.weekStart = val as WeekDay;
        break;
    }
  }

  return rule;
}

/**
 * Unescape ICS text value
 */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// ============================================================
// MAIN PARSER
// ============================================================

/**
 * Parse an ICS file content into a Calendar object
 */
export function parseICS(icsContent: string): Calendar {
  const lines = unfoldLines(icsContent);
  const calendar: Calendar = { ...DEFAULT_CALENDAR, events: [] };
  
  let currentEvent: Partial<CalendarEvent> | null = null;
  let currentAlarm: Partial<Alarm> | null = null;
  let currentTimezone: Partial<TimezoneInfo> | null = null;
  let inEvent = false;
  let inAlarm = false;
  let inTimezone = false;
  let inDaylight = false;
  let inStandard = false;

  for (const line of lines) {
    const { name, params, value } = parsePropertyLine(line);

    // Handle component boundaries
    if (name === 'BEGIN') {
      switch (value) {
        case 'VEVENT':
          inEvent = true;
          currentEvent = { ...DEFAULT_EVENT };
          break;
        case 'VALARM':
          inAlarm = true;
          currentAlarm = {};
          break;
        case 'VTIMEZONE':
          inTimezone = true;
          currentTimezone = {};
          break;
        case 'DAYLIGHT':
          inDaylight = true;
          break;
        case 'STANDARD':
          inStandard = true;
          break;
      }
      continue;
    }

    if (name === 'END') {
      switch (value) {
        case 'VEVENT':
          if (currentEvent && currentEvent.uid && currentEvent.startDate) {
            calendar.events.push(currentEvent as CalendarEvent);
          }
          inEvent = false;
          currentEvent = null;
          break;
        case 'VALARM':
          if (currentAlarm && currentEvent) {
            if (!currentEvent.alarms) currentEvent.alarms = [];
            currentEvent.alarms.push(currentAlarm as Alarm);
          }
          inAlarm = false;
          currentAlarm = null;
          break;
        case 'VTIMEZONE':
          if (currentTimezone && currentTimezone.tzid) {
            calendar.timezone = currentTimezone as TimezoneInfo;
          }
          inTimezone = false;
          currentTimezone = null;
          break;
        case 'DAYLIGHT':
          inDaylight = false;
          break;
        case 'STANDARD':
          inStandard = false;
          break;
      }
      continue;
    }

    // Parse calendar-level properties
    if (!inEvent && !inTimezone) {
      switch (name) {
        case 'PRODID':
          calendar.prodId = value;
          break;
        case 'VERSION':
          calendar.version = value;
          break;
        case 'CALSCALE':
          calendar.calscale = value;
          break;
        case 'METHOD':
          calendar.method = value;
          break;
        case 'X-WR-CALNAME':
          calendar.name = value;
          break;
        case 'X-WR-CALDESC':
          calendar.description = value;
          break;
      }
    }

    // Parse timezone properties
    if (inTimezone && currentTimezone && !inDaylight && !inStandard) {
      if (name === 'TZID') {
        currentTimezone.tzid = value;
      }
    }
    
    if (inTimezone && currentTimezone) {
      if (inDaylight) {
        if (name === 'TZNAME') currentTimezone.daylightName = value;
        if (name === 'TZOFFSETTO') currentTimezone.daylightOffset = value;
      }
      if (inStandard) {
        if (name === 'TZNAME') currentTimezone.standardName = value;
        if (name === 'TZOFFSETTO') currentTimezone.standardOffset = value;
      }
    }

    // Parse alarm properties
    if (inAlarm && currentAlarm) {
      switch (name) {
        case 'ACTION':
          currentAlarm.action = value as AlarmAction;
          break;
        case 'TRIGGER':
          if (params.VALUE === 'DATE-TIME') {
            currentAlarm.triggerType = 'ABSOLUTE';
            currentAlarm.triggerValue = parseDateTime(value).getTime();
          } else {
            const related = params.RELATED || 'START';
            const duration = parseDuration(value);
            if (duration < 0) {
              currentAlarm.triggerType = related === 'END' ? 'BEFORE_END' : 'BEFORE_START';
              currentAlarm.triggerValue = Math.abs(duration);
            } else {
              currentAlarm.triggerType = related === 'END' ? 'AFTER_END' : 'AFTER_START';
              currentAlarm.triggerValue = duration;
            }
          }
          break;
        case 'DESCRIPTION':
          currentAlarm.description = unescapeText(value);
          break;
        case 'SUMMARY':
          currentAlarm.summary = unescapeText(value);
          break;
        case 'REPEAT':
          currentAlarm.repeat = parseInt(value);
          break;
        case 'DURATION':
          currentAlarm.duration = parseDuration(value);
          break;
      }
    }

    // Parse event properties
    if (inEvent && currentEvent && !inAlarm) {
      const tzid = params.TZID;

      switch (name) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'SUMMARY':
          currentEvent.summary = unescapeText(value);
          break;
        case 'DESCRIPTION':
          currentEvent.description = unescapeText(value);
          break;
        case 'DTSTART':
          if (params.VALUE === 'DATE') {
            currentEvent.startDate = parseDate(value);
            currentEvent.allDay = true;
          } else {
            currentEvent.startDate = parseDateTime(value, tzid);
            currentEvent.allDay = false;
          }
          if (tzid) currentEvent.timezone = tzid;
          break;
        case 'DTEND':
          if (params.VALUE === 'DATE') {
            currentEvent.endDate = parseDate(value);
          } else {
            currentEvent.endDate = parseDateTime(value, tzid);
          }
          break;
        case 'LOCATION':
          if (!currentEvent.location) {
            currentEvent.location = { text: '' };
          }
          currentEvent.location.text = unescapeText(value);
          break;
        case 'GEO':
          if (!currentEvent.location) {
            currentEvent.location = { text: '' };
          }
          currentEvent.location.geo = parseGeo(value);
          break;
        case 'URL':
          currentEvent.url = value;
          break;
        case 'STATUS':
          currentEvent.status = value as EventStatus;
          break;
        case 'CLASS':
          currentEvent.classification = value as EventClass;
          break;
        case 'TRANSP':
          currentEvent.transparency = value as TimeTransparency;
          break;
        case 'CATEGORIES':
          currentEvent.categories = value.split(',').map(c => c.trim());
          break;
        case 'PRIORITY':
          currentEvent.priority = parseInt(value);
          break;
        case 'SEQUENCE':
          currentEvent.sequence = parseInt(value);
          break;
        case 'CREATED':
          currentEvent.created = parseDateTime(value);
          break;
        case 'LAST-MODIFIED':
        case 'DTSTAMP':
          currentEvent.lastModified = parseDateTime(value);
          break;
        case 'RRULE':
          currentEvent.recurrenceRule = parseRRule(value);
          break;
        case 'ORGANIZER':
          const orgEmail = value.replace('mailto:', '');
          currentEvent.organizer = {
            email: orgEmail,
            name: params.CN,
            directory: params.DIR,
          };
          break;
        case 'ATTENDEE':
          const attEmail = value.replace('mailto:', '');
          const attendee: Attendee = {
            email: attEmail,
            name: params.CN,
            role: (params.ROLE || 'REQ-PARTICIPANT') as AttendeeRole,
            participationStatus: (params.PARTSTAT || 'NEEDS-ACTION') as AttendeeParticipationStatus,
            rsvp: params.RSVP === 'TRUE',
            directory: params.DIR,
          };
          if (!currentEvent.attendees) currentEvent.attendees = [];
          currentEvent.attendees.push(attendee);
          break;
        // Microsoft extensions
        case 'X-MICROSOFT-CDO-BUSYSTATUS':
          if (!currentEvent.microsoftExtensions) {
            currentEvent.microsoftExtensions = {};
          }
          currentEvent.microsoftExtensions.busyStatus = value as MicrosoftExtensions['busyStatus'];
          break;
        case 'X-MICROSOFT-CDO-IMPORTANCE':
          if (!currentEvent.microsoftExtensions) {
            currentEvent.microsoftExtensions = {};
          }
          currentEvent.microsoftExtensions.importance = value as MicrosoftExtensions['importance'];
          break;
        case 'X-MICROSOFT-CDO-ALLDAYEVENT':
          if (!currentEvent.microsoftExtensions) {
            currentEvent.microsoftExtensions = {};
          }
          currentEvent.microsoftExtensions.allDayEvent = value === 'TRUE';
          break;
        // Apple extensions
        case 'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR':
          if (!currentEvent.appleExtensions) {
            currentEvent.appleExtensions = {};
          }
          currentEvent.appleExtensions.travelAdvisoryBehavior = value as AppleExtensions['travelAdvisoryBehavior'];
          break;
        case 'X-APPLE-CREATOR-IDENTITY':
          if (!currentEvent.appleExtensions) {
            currentEvent.appleExtensions = {};
          }
          currentEvent.appleExtensions.creatorIdentity = value;
          break;
        case 'X-APPLE-STRUCTURED-LOCATION':
          if (!currentEvent.appleExtensions) {
            currentEvent.appleExtensions = {};
          }
          // Parse the structured location
          const titleMatch = value.match(/X-TITLE="([^"]+)"/);
          const radiusMatch = line.match(/X-APPLE-RADIUS=([0-9.]+)/);
          currentEvent.appleExtensions.structuredLocation = {
            title: titleMatch ? titleMatch[1] : '',
            radius: radiusMatch ? parseFloat(radiusMatch[1]) : undefined,
          };
          // Extract geo from the value if present
          const geoMatch = value.match(/geo:([0-9.-]+),([0-9.-]+)/);
          if (geoMatch && currentEvent.location) {
            currentEvent.location.geo = {
              latitude: parseFloat(geoMatch[1]),
              longitude: parseFloat(geoMatch[2]),
            };
          }
          break;
      }
    }
  }

  return calendar;
}

/**
 * Parse ICS file from a File object
 */
export function parseICSFile(file: File): Promise<Calendar> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const calendar = parseICS(content);
        resolve(calendar);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
