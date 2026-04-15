export type Theme = 'system' | 'light' | 'dark' | 'oled'
export type Language = 'en' | 'es' | 'ro'
export type TimeFormat = '12h' | '24h'
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
export type DefaultView = 'events' | 'month' | 'week' | 'day' | 'agenda'
export type ActiveView = 'events' | 'calendar' | 'templates' | 'import-export' | 'settings'
export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda'

export interface AppSettings {
  theme: Theme
  language: Language
  timeFormat: TimeFormat
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  dateFormat: DateFormat
  showWeekNumbers: boolean
  defaultDuration: number
  defaultTimezone: string
  defaultReminder: number
  defaultCalendarColor: string
  defaultView: DefaultView
  confirmBeforeDelete: boolean
  autoSaveInterval: number
  compactEventCards: boolean
  exportAppleExtensions: boolean
  defaultEventStatus: 'TENTATIVE' | 'CONFIRMED'
  defaultClassification: 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'
  snapMinutesTo: 1 | 5 | 10 | 15 | 30
  showDeclinedEvents: boolean
  weekendDays: number[]
  stripPersonalDataOnExport: boolean
}
