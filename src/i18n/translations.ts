/**
 * Translations System
 * Each language is in its own file under ./locales/
 */

// Type definitions
export type Language = 'en' | 'es' | 'de' | 'fr' | 'it' | 'pt' | 'zh' | 'ja' | 'ko' | 'ru';

export interface Translations {
  // App
  appName: string;
  appDescription: string;
  
  // Actions
  newEvent: string;
  newBlankEvent: string;
  newFromTemplate: string;
  editEvent: string;
  deleteEvent: string;
  duplicateEvent: string;
  save: string;
  cancel: string;
  close: string;
  import: string;
  export: string;
  search: string;
  filter: string;
  clear: string;
  clearAll: string;
  undo: string;
  redo: string;
  edit: string;
  duplicate: string;
  delete: string;
  
  // Import/Export
  importICS: string;
  importFromFile: string;
  exportAllEvents: string;
  exportSelectedEvent: string;
  exportOptions: string;
  noEventSelected: string;
  selectedEventLabel: string;
  releaseToImport: string;
  
  // Views
  listView: string;
  calendarView: string;
  monthView: string;
  weekView: string;
  dayView: string;
  agendaView: string;
  
  // Event Fields
  eventTitle: string;
  eventDescription: string;
  location: string;
  startDate: string;
  endDate: string;
  allDay: string;
  timezone: string;
  reminders: string;
  addReminder: string;
  recurrence: string;
  categories: string;
  url: string;
  notes: string;
  attendees: string;
  organizer: string;
  status: string;
  priority: string;
  color: string;
  
  // Templates
  templates: string;
  useTemplate: string;
  saveAsTemplate: string;
  importTemplate: string;
  exportTemplate: string;
  templateName: string;
  noTemplates: string;
  templateSaved: string;
  templateDeleted: string;
  customTemplates: string;
  builtInTemplates: string;
  selectTemplate: string;
  createEvent: string;
  blank: string;
  modified: string;
  fromFile: string;
  expandAll: string;
  collapseAll: string;
  verticalLayout: string;
  tabLayout: string;
  
  // Template Names
  templateMeeting: string;
  templateCall: string;
  templateLunch: string;
  templateWorkout: string;
  templateFocus: string;
  templateBirthday: string;
  templateReminder: string;
  templateTravel: string;
  templateDeadline: string;
  templateAppointment: string;
  
  // Export
  exportFormat: string;
  exportICS: string;
  exportJSON: string;
  exportMarkdown: string;
  exportCSV: string;
  exportGoogleCalendar: string;
  exportOutlook: string;
  exportAppleCalendar: string;
  exportAll: string;
  exportSelected: string;
  copyToClipboard: string;
  copiedToClipboard: string;
  openInBrowser: string;
  
  // Import
  importFile: string;
  importTemplateFile: string;
  dragDropImport: string;
  
  // Command Palette
  quickActions: string;
  typeToSearch: string;
  noResults: string;
  actions: string;
  events: string;
  settings: string;
  switchToTheme: string;
  currentTheme: string;
  
  // Settings
  language: string;
  darkMode: string;
  lightMode: string;
  theme: string;
  
  // Theme names
  themeLight: string;
  themeDark: string;
  themeOled: string;
  themeNeumorphic: string;
  themeGlass: string;
  
  // Messages
  eventCreated: string;
  eventUpdated: string;
  eventDeleted: string;
  eventDuplicated: string;
  eventsImported: string;
  exportSuccess: string;
  errorOccurred: string;
  confirmDelete: string;
  confirmClearAll: string;
  noEvents: string;
  noEventsYet: string;
  createFirstEvent: string;
  allEventsCleared: string;
  
  // Settings Panel
  appearance: string;
  data: string;
  localStorage: string;
  clearAllData: string;
  clearDataDescription: string;
  confirmClearData: string;
  clearDataWarning: string;
  about: string;
  version: string;
  
  // Sidebar
  selectedEvent: string;
  shortcuts: string;
  searchCommands: string;
  event: string;
  
  // Footer
  footerText: string;
  
  // Time
  today: string;
  tomorrow: string;
  yesterday: string;
  thisWeek: string;
  nextWeek: string;
  thisMonth: string;
  
  // Days
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  
  // Short Days
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
  
  // Months
  january: string;
  february: string;
  march: string;
  april: string;
  may: string;
  june: string;
  july: string;
  august: string;
  september: string;
  october: string;
  november: string;
  december: string;
  
  // Features
  features: string;
  keyboardShortcuts: string;
  importExportICS: string;
  appleCalendarSupport: string;
  googleCalendarSupport: string;
  outlookSupport: string;
  recurringEvents: string;
  multipleReminders: string;
  timezoneSupport: string;
  geolocation: string;
  allDayEvents: string;
  eventCategories: string;
}

// Import locale files
import { en as enLocale } from './locales/en';
import { es as esLocale } from './locales/es';
import { de as deLocale } from './locales/de';
import { fr as frLocale } from './locales/fr';

// Export locales
export const en = enLocale;
export const es = esLocale;
export const de = deLocale;
export const fr = frLocale;

// All translations
export const translations: Record<Language, Translations> = {
  en,
  es,
  de,
  fr,
  it: en, // Fallback
  pt: en,
  zh: en,
  ja: en,
  ko: en,
  ru: en,
};

// Language names for display
export const languageNames: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
};

// Get browser language
export function getBrowserLanguage(): Language {
  const browserLang = navigator.language.split('-')[0] as Language;
  return translations[browserLang] ? browserLang : 'en';
}
