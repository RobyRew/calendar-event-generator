/**
 * i18n Types
 */

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
  
  // Import/Export
  importICS: string;
  importFromFile: string;
  exportAllEvents: string;
  exportSelectedEvent: string;
  exportOptions: string;
  noEventSelected: string;
  selectedEventLabel: string;
  
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
  
  // Settings
  language: string;
  darkMode: string;
  lightMode: string;
  theme: string;
  
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
