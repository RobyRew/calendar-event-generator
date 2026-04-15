import type { AppSettings, WeekDay } from '@/types'

export const APP_NAME = 'Calendar Event Generator'
export const APP_VERSION = '2.0.0'
export const PROD_ID = '-//CalGen//Calendar Event Generator 2.0//EN'

export const STORAGE_KEYS = {
  settings: 'calgen_settings',
  language: 'calgen_language',
  theme: 'calgen_theme',
} as const

export const DB_NAME = 'CalendarEventGenerator'
export const DB_VERSION = 1

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  timeFormat: '24h',
  firstDayOfWeek: 1,
  dateFormat: 'DD/MM/YYYY',
  showWeekNumbers: false,
  defaultDuration: 60,
  defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  defaultReminder: 30,
  defaultCalendarColor: '#007aff',
  defaultView: 'events',
  confirmBeforeDelete: true,
  autoSaveInterval: 0,
  compactEventCards: false,
  exportAppleExtensions: true,
  defaultEventStatus: 'CONFIRMED',
  defaultClassification: 'PUBLIC',
  snapMinutesTo: 5,
  showDeclinedEvents: false,
  weekendDays: [0, 6],
  stripPersonalDataOnExport: false,
}

export const EVENT_COLORS = [
  '#007aff', '#5856d6', '#af52de', '#ff2d55', '#ff3b30',
  '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#30b0c7',
  '#32ade6', '#5ac8fa', '#8e8e93', '#48484a', '#636366',
] as const

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Bucharest',
  'Europe/Chisinau',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Pacific/Honolulu',
] as const

export const REMINDER_PRESETS = [
  { value: 0, labelKey: 'atTimeOfEvent' },
  { value: 5, labelKey: 'minutesBefore', count: 5 },
  { value: 10, labelKey: 'minutesBefore', count: 10 },
  { value: 15, labelKey: 'minutesBefore', count: 15 },
  { value: 30, labelKey: 'minutesBefore', count: 30 },
  { value: 60, labelKey: 'hoursBefore', count: 1 },
  { value: 120, labelKey: 'hoursBefore', count: 2 },
  { value: 1440, labelKey: 'daysBefore', count: 1 },
  { value: 2880, labelKey: 'daysBefore', count: 2 },
  { value: 10080, labelKey: 'weeksBefore', count: 1 },
] as const

export const DURATION_PRESETS = [
  { value: 15, label: '15 min', labelKey: 'minutes', count: 15 },
  { value: 30, label: '30 min', labelKey: 'minutes', count: 30 },
  { value: 45, label: '45 min', labelKey: 'minutes', count: 45 },
  { value: 60, label: '1 hour', labelKey: 'hours', count: 1 },
  { value: 90, label: '1.5 hours', labelKey: 'minutes', count: 90 },
  { value: 120, label: '2 hours', labelKey: 'hours', count: 2 },
  { value: 180, label: '3 hours', labelKey: 'hours', count: 3 },
  { value: 240, label: '4 hours', labelKey: 'hours', count: 4 },
  { value: 480, label: '8 hours', labelKey: 'hours', count: 8 },
  { value: 1440, label: '1 day', labelKey: 'days', count: 1 },
] as const

export const WEEK_DAYS: WeekDay[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export const APPLE_ALARM_SOUNDS = [
  'Basso', 'Blow', 'Bottle', 'Frog', 'Funk', 'Glass',
  'Hero', 'Morse', 'Ping', 'Pop', 'Purr', 'Sosumi',
  'Submarine', 'Tink', 'Chord',
] as const

export const MAX_UNDO_HISTORY = 50
