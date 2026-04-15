export type EventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'
export type EventClassification = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'
export type EventTransparency = 'OPAQUE' | 'TRANSPARENT'
export type AlarmAction = 'DISPLAY' | 'EMAIL' | 'AUDIO'
export type AlarmTriggerRelation = 'START' | 'END'
export type AttendeeRole = 'CHAIR' | 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' | 'NON-PARTICIPANT'
export type AttendeeStatus = 'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'DELEGATED'
export type AttendeeType = 'INDIVIDUAL' | 'GROUP' | 'RESOURCE' | 'ROOM' | 'UNKNOWN'
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type WeekDay = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'
export type TravelAdvisory = 'AUTOMATIC' | 'DISABLED' | 'ENABLED'

export interface GeoLocation {
  latitude: number
  longitude: number
}

export interface EventLocation {
  text: string
  geo?: GeoLocation
  uri?: string
  appleAddress?: string
  appleTitle?: string
  appleRadius?: number
  appleMapItemHandle?: string
}

export interface EventOrganizer {
  name: string
  email: string
  dir?: string
  sentBy?: string
}

export interface EventAttendee {
  name: string
  email: string
  role: AttendeeRole
  status: AttendeeStatus
  type: AttendeeType
  rsvp: boolean
  dir?: string
  delegatedFrom?: string
  delegatedTo?: string
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
  count?: number
  until?: string
  byDay?: WeekDay[]
  byMonthDay?: number[]
  byMonth?: number[]
  bySetPos?: number[]
  weekStart?: WeekDay
}

export interface EventAlarm {
  uid: string
  action: AlarmAction
  trigger: string
  triggerRelation: AlarmTriggerRelation
  description: string
  summary?: string
  duration?: string
  repeat?: number
  acknowledged?: string
  attachUri?: string
  isDefault: boolean
}

export interface EventAttachment {
  uri: string
  mimeType?: string
  filename?: string
  size?: number
}

export interface AppleExtensions {
  creatorIdentity?: string
  creatorTeamIdentity?: string
  travelAdvisory?: TravelAdvisory
  structuredData?: string
  structuredLocation?: string
  endLocation?: EventLocation
  suggestionInfo?: Record<string, string>
}

export interface GoogleExtensions {
  conferenceUrl?: string
  colorId?: string
  hangoutLink?: string
}

export interface MicrosoftExtensions {
  busyStatus?: string
  importance?: string
  ownerApptId?: string
  allDayEvent?: boolean
}

export interface CalendarEvent {
  uid: string
  sequence: number
  summary: string
  description: string
  comment: string
  startDate: string
  endDate: string
  allDay: boolean
  timezone: string
  status: EventStatus
  classification: EventClassification
  transparency: EventTransparency
  location: EventLocation | null
  organizer: EventOrganizer | null
  attendees: EventAttendee[]
  recurrenceRule: RecurrenceRule | null
  recurrenceExceptions: string[]
  recurrenceId: string
  alarms: EventAlarm[]
  categories: string[]
  color: string
  priority: number
  url: string
  attachments: EventAttachment[]
  relatedTo: string
  resources: string[]
  contact: string
  created: string
  lastModified: string
  dtstamp: string
  apple: AppleExtensions
  google: GoogleExtensions
  microsoft: MicrosoftExtensions
  templateId: string
  sourceFile: string
  sourceCalendar: string
}

export interface EventTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  categories: string[]
  isBuiltIn: boolean
  event: Partial<CalendarEvent>
  createdAt?: string
  updatedAt?: string
}

export interface CalendarMeta {
  prodId: string
  version: string
  calscale: string
  method?: string
  calendarName?: string
  calendarColor?: string
}

export interface TimezoneRule {
  dtstart: string
  rrule?: string
  tzname: string
  tzoffsetfrom: string
  tzoffsetto: string
}

export interface TimezoneDefinition {
  tzid: string
  standard?: TimezoneRule
  daylight?: TimezoneRule
}

export interface ParsedCalendar {
  meta: CalendarMeta
  timezones: TimezoneDefinition[]
  events: CalendarEvent[]
}
