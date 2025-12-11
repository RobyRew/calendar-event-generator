/**
 * German translations
 */

import type { Translations } from '../translations';

export const de: Translations = {
  // App
  appName: 'Kalender-Event-Generator',
  appDescription: 'Erstellen Sie Events für Apple, Google & Microsoft Kalender',
  
  // Actions
  newEvent: 'Neues Event',
  newBlankEvent: 'Neues leeres Event',
  newFromTemplate: 'Aus Vorlage...',
  editEvent: 'Event Bearbeiten',
  deleteEvent: 'Event Löschen',
  duplicateEvent: 'Event Duplizieren',
  save: 'Speichern',
  cancel: 'Abbrechen',
  close: 'Schließen',
  import: 'Importieren',
  export: 'Exportieren',
  search: 'Suchen',
  filter: 'Filtern',
  clear: 'Löschen',
  clearAll: 'Alle Löschen',
  undo: 'Rückgängig',
  redo: 'Wiederholen',
  edit: 'Bearbeiten',
  duplicate: 'Duplizieren',
  delete: 'Löschen',
  
  // Import/Export
  importICS: 'ICS-Datei importieren',
  importFromFile: 'Aus Datei importieren',
  exportAllEvents: 'Alle Events exportieren',
  exportSelectedEvent: 'Ausgewähltes Event exportieren',
  exportOptions: 'Export-Optionen...',
  noEventSelected: 'Kein Event ausgewählt',
  selectedEventLabel: 'Ausgewähltes Event:',
  releaseToImport: 'Loslassen zum Importieren von Kalender-Events',
  
  // Views
  listView: 'Liste',
  calendarView: 'Kalender',
  monthView: 'Monat',
  weekView: 'Woche',
  dayView: 'Tag',
  agendaView: 'Agenda',
  
  // Event Fields
  eventTitle: 'Event-Titel',
  eventDescription: 'Beschreibung',
  location: 'Ort',
  startDate: 'Startdatum',
  endDate: 'Enddatum',
  allDay: 'Ganztägig',
  timezone: 'Zeitzone',
  reminders: 'Erinnerungen',
  addReminder: 'Erinnerung hinzufügen',
  recurrence: 'Wiederholung',
  categories: 'Kategorien',
  url: 'URL',
  notes: 'Notizen',
  attendees: 'Teilnehmer',
  organizer: 'Organisator',
  status: 'Status',
  priority: 'Priorität',
  color: 'Farbe',
  
  // Templates
  templates: 'Vorlagen',
  useTemplate: 'Vorlage verwenden',
  saveAsTemplate: 'Als Vorlage speichern',
  importTemplate: 'Vorlage importieren',
  exportTemplate: 'Vorlage exportieren',
  templateName: 'Vorlagenname',
  noTemplates: 'Keine Vorlagen verfügbar',
  templateSaved: 'Vorlage gespeichert!',
  templateDeleted: 'Vorlage gelöscht',
  customTemplates: 'Eigene Vorlagen',
  builtInTemplates: 'Eingebaute Vorlagen',
  selectTemplate: 'Vorlage auswählen...',
  createEvent: 'Aus Vorlage erstellen',
  blank: 'Leer',
  modified: 'Geändert',
  fromFile: 'Von:',
  expandAll: 'Alle ausklappen',
  collapseAll: 'Alle einklappen',
  verticalLayout: 'Vertikale Ansicht',
  tabLayout: 'Tab-Ansicht',
  
  // Template Names
  templateMeeting: 'Besprechung',
  templateCall: 'Telefonat',
  templateLunch: 'Mittagessen',
  templateWorkout: 'Training',
  templateFocus: 'Fokuszeit',
  templateBirthday: 'Geburtstag',
  templateReminder: 'Erinnerung',
  templateTravel: 'Reise',
  templateDeadline: 'Frist',
  templateAppointment: 'Termin',
  
  // Export
  exportFormat: 'Exportformat',
  exportICS: 'ICS (iCalendar)',
  exportJSON: 'JSON',
  exportMarkdown: 'Markdown',
  exportCSV: 'CSV',
  exportGoogleCalendar: 'Google Kalender',
  exportOutlook: 'Outlook Web',
  exportAppleCalendar: 'Apple Kalender',
  exportAll: 'Alle exportieren',
  exportSelected: 'Ausgewählte exportieren',
  copyToClipboard: 'In Zwischenablage kopieren',
  copiedToClipboard: 'In Zwischenablage kopiert!',
  openInBrowser: 'Im Browser öffnen',
  
  // Import
  importFile: 'Datei importieren',
  importTemplateFile: 'Vorlage importieren',
  dragDropImport: 'Dateien zum Importieren ablegen',
  
  // Command Palette
  quickActions: 'Schnellaktionen',
  typeToSearch: 'Zum Suchen tippen...',
  noResults: 'Keine Ergebnisse',
  actions: 'Aktionen',
  events: 'Events',
  settings: 'Einstellungen',
  switchToTheme: 'Wechseln zu',
  currentTheme: 'Aktuell',
  
  // Settings
  language: 'Sprache',
  darkMode: 'Dunkelmodus',
  lightMode: 'Hellmodus',
  theme: 'Thema',
  
  // Theme names
  themeLight: 'Hell',
  themeDark: 'Dunkel',
  themeOled: 'OLED',
  themeNeumorphic: 'Neumorphisch',
  themeGlass: 'Flüssiges Glas',
  
  // Messages
  eventCreated: 'Event erstellt!',
  eventUpdated: 'Event aktualisiert!',
  eventDeleted: 'Event gelöscht',
  eventDuplicated: 'Event dupliziert!',
  eventsImported: 'Events importiert',
  exportSuccess: 'Export erfolgreich!',
  errorOccurred: 'Ein Fehler ist aufgetreten',
  confirmDelete: 'Möchten Sie dieses Event wirklich löschen?',
  confirmClearAll: 'Möchten Sie wirklich alle Events löschen?',
  noEvents: 'Keine Events',
  noEventsYet: 'Noch keine Events',
  createFirstEvent: 'Erstellen Sie Ihr erstes Kalender-Event oder importieren Sie vorhandene Events aus einer ICS-Datei',
  allEventsCleared: 'Alle Events gelöscht',
  
  // Sidebar
  selectedEvent: 'Ausgewähltes Event',
  shortcuts: 'Tastenkürzel',
  searchCommands: 'Suchen / Befehle',
  event: 'Event',
  
  // Footer
  footerText: 'Kalender-Event-Generator - Erstellen Sie Events für Apple, Google & Microsoft Kalender',
  
  // Time
  today: 'Heute',
  tomorrow: 'Morgen',
  yesterday: 'Gestern',
  thisWeek: 'Diese Woche',
  nextWeek: 'Nächste Woche',
  thisMonth: 'Dieser Monat',
  
  // Days
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
  
  // Short Days
  mon: 'Mo',
  tue: 'Di',
  wed: 'Mi',
  thu: 'Do',
  fri: 'Fr',
  sat: 'Sa',
  sun: 'So',
  
  // Months
  january: 'Januar',
  february: 'Februar',
  march: 'März',
  april: 'April',
  may: 'Mai',
  june: 'Juni',
  july: 'Juli',
  august: 'August',
  september: 'September',
  october: 'Oktober',
  november: 'November',
  december: 'Dezember',
  
  // Features
  features: 'Funktionen',
  keyboardShortcuts: 'Tastaturkürzel',
  importExportICS: 'ICS importieren/exportieren',
  appleCalendarSupport: 'Apple Kalender Unterstützung',
  googleCalendarSupport: 'Google Kalender Links',
  outlookSupport: 'Microsoft Outlook Unterstützung',
  recurringEvents: 'Wiederkehrende Events (RRULE)',
  multipleReminders: 'Mehrere Erinnerungen',
  timezoneSupport: 'Zeitzonenunterstützung',
  geolocation: 'Geolokalisierung für Karten',
  allDayEvents: 'Ganztägige Events',
  eventCategories: 'Event-Kategorien',
};
