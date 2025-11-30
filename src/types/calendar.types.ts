/**
 * Calendar Event Types
 * Comprehensive type definitions for calendar events supporting
 * Apple Calendar, Google Calendar, and Microsoft Outlook
 */

// ============================================================
// ENUMS
// ============================================================

/** Event recurrence frequency */
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Days of the week for recurrence */
export type WeekDay = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

/** Event status */
export type EventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';

/** Event classification/visibility */
export type EventClass = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';

/** Time transparency (busy/free status) */
export type TimeTransparency = 'OPAQUE' | 'TRANSPARENT';

/** Alarm action types */
export type AlarmAction = 'DISPLAY' | 'EMAIL' | 'AUDIO';

/** Alarm trigger type */
export type AlarmTriggerType = 'BEFORE_START' | 'BEFORE_END' | 'AFTER_START' | 'AFTER_END' | 'ABSOLUTE';

/** Microsoft busy status */
export type MicrosoftBusyStatus = 'FREE' | 'TENTATIVE' | 'BUSY' | 'OOF' | 'WORKING_ELSEWHERE';

/** Attendee role */
export type AttendeeRole = 'CHAIR' | 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' | 'NON-PARTICIPANT';

/** Attendee participation status */
export type AttendeeParticipationStatus = 'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'DELEGATED';

/** Calendar provider type */
export type CalendarProvider = 'apple' | 'google' | 'microsoft' | 'generic';

// ============================================================
// INTERFACES
// ============================================================

/** Geographic coordinates */
export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/** Timezone definition */
export interface TimezoneInfo {
  tzid: string;
  standardOffset: string;
  daylightOffset?: string;
  standardName?: string;
  daylightName?: string;
}

/** Event organizer */
export interface Organizer {
  name?: string;
  email: string;
  directory?: string;
}

/** Event attendee */
export interface Attendee {
  name?: string;
  email: string;
  role: AttendeeRole;
  participationStatus: AttendeeParticipationStatus;
  rsvp?: boolean;
  directory?: string;
}

/** Recurrence rule */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number;
  count?: number;
  until?: Date;
  byDay?: WeekDay[];
  byMonthDay?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  weekStart?: WeekDay;
}

/** Exception dates for recurring events */
export interface RecurrenceException {
  date: Date;
  isRDate?: boolean; // true = RDATE (additional), false = EXDATE (excluded)
}

/** Alarm/Reminder */
export interface Alarm {
  action: AlarmAction;
  triggerType: AlarmTriggerType;
  triggerValue: number; // in minutes for relative, or timestamp for absolute
  description?: string;
  summary?: string;
  attendees?: Attendee[];
  attachUri?: string;
  repeat?: number;
  duration?: number; // in minutes
}

/** Attachment */
export interface Attachment {
  uri?: string;
  base64?: string;
  mimeType?: string;
  filename?: string;
}

/** Location with structured data */
export interface EventLocation {
  text: string;
  geo?: GeoLocation;
  // Apple-specific
  appleStructuredLocation?: {
    title: string;
    radius?: number;
    mapkitHandle?: string;
  };
  // Google-specific
  googleConferenceData?: {
    conferenceId?: string;
    entryPoints?: Array<{
      entryPointType: 'video' | 'phone' | 'sip' | 'more';
      uri: string;
      label?: string;
    }>;
  };
}

/** Apple-specific properties */
export interface AppleExtensions {
  travelAdvisoryBehavior?: 'AUTOMATIC' | 'DISABLED';
  creatorIdentity?: string;
  structuredLocation?: {
    title: string;
    radius?: number;
    mapkitHandle?: string;
    referenceFrame?: number;
  };
}

/** Microsoft-specific properties */
export interface MicrosoftExtensions {
  busyStatus?: MicrosoftBusyStatus;
  importance?: 'LOW' | 'NORMAL' | 'HIGH';
  allDayEvent?: boolean;
  instType?: number;
  responseRequested?: boolean;
}

/** Google-specific properties */
export interface GoogleExtensions {
  colorId?: string;
  conferenceData?: {
    createRequest?: boolean;
    conferenceId?: string;
  };
  visibility?: 'default' | 'public' | 'private' | 'confidential';
}

/** Complete Calendar Event */
export interface CalendarEvent {
  // Core properties
  uid: string;
  summary: string;
  description?: string;
  
  // Date/Time
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  timezone?: string;
  
  // Location
  location?: EventLocation;
  
  // URL
  url?: string;
  
  // Classification
  status: EventStatus;
  classification: EventClass;
  transparency: TimeTransparency;
  
  // Categories/Tags
  categories?: string[];
  
  // Priority (1-9, 1 highest)
  priority?: number;
  
  // Organizer & Attendees
  organizer?: Organizer;
  attendees?: Attendee[];
  
  // Recurrence
  recurrenceRule?: RecurrenceRule;
  recurrenceExceptions?: RecurrenceException[];
  recurrenceId?: Date;
  
  // Alarms/Reminders
  alarms?: Alarm[];
  
  // Attachments
  attachments?: Attachment[];
  
  // Metadata
  created?: Date;
  lastModified?: Date;
  sequence?: number;
  
  // Platform-specific extensions
  appleExtensions?: AppleExtensions;
  microsoftExtensions?: MicrosoftExtensions;
  googleExtensions?: GoogleExtensions;
}

/** Calendar container */
export interface Calendar {
  prodId: string;
  version: string;
  calscale: string;
  method?: string;
  name?: string;
  description?: string;
  timezone?: TimezoneInfo;
  events: CalendarEvent[];
}

// ============================================================
// DEFAULT VALUES
// ============================================================

export const DEFAULT_PRODID = '-//CalendarEventGenerator//v1.0//EN';

export const DEFAULT_CALENDAR: Calendar = {
  prodId: DEFAULT_PRODID,
  version: '2.0',
  calscale: 'GREGORIAN',
  method: 'PUBLISH',
  events: [],
};

export const DEFAULT_EVENT: Partial<CalendarEvent> = {
  status: 'CONFIRMED',
  classification: 'PUBLIC',
  transparency: 'OPAQUE',
  allDay: false,
  sequence: 0,
};

// ============================================================
// TIMEZONE PRESETS
// ============================================================

export const COMMON_TIMEZONES: Record<string, TimezoneInfo> = {
  'UTC': {
    tzid: 'UTC',
    standardOffset: '+0000',
  },
  'Europe/Madrid': {
    tzid: 'Europe/Madrid',
    standardOffset: '+0100',
    daylightOffset: '+0200',
    standardName: 'CET',
    daylightName: 'CEST',
  },
  'Europe/London': {
    tzid: 'Europe/London',
    standardOffset: '+0000',
    daylightOffset: '+0100',
    standardName: 'GMT',
    daylightName: 'BST',
  },
  'Europe/Berlin': {
    tzid: 'Europe/Berlin',
    standardOffset: '+0100',
    daylightOffset: '+0200',
    standardName: 'CET',
    daylightName: 'CEST',
  },
  'Europe/Bucharest': {
    tzid: 'Europe/Bucharest',
    standardOffset: '+0200',
    daylightOffset: '+0300',
    standardName: 'EET',
    daylightName: 'EEST',
  },
  'America/New_York': {
    tzid: 'America/New_York',
    standardOffset: '-0500',
    daylightOffset: '-0400',
    standardName: 'EST',
    daylightName: 'EDT',
  },
  'America/Los_Angeles': {
    tzid: 'America/Los_Angeles',
    standardOffset: '-0800',
    daylightOffset: '-0700',
    standardName: 'PST',
    daylightName: 'PDT',
  },
  'Asia/Tokyo': {
    tzid: 'Asia/Tokyo',
    standardOffset: '+0900',
    standardName: 'JST',
  },
  'Asia/Shanghai': {
    tzid: 'Asia/Shanghai',
    standardOffset: '+0800',
    standardName: 'CST',
  },
  'Australia/Sydney': {
    tzid: 'Australia/Sydney',
    standardOffset: '+1000',
    daylightOffset: '+1100',
    standardName: 'AEST',
    daylightName: 'AEDT',
  },
};
