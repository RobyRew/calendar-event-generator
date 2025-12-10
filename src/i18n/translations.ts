/**
 * Internationalization (i18n) System
 * Supports multiple languages with fallback to English
 */

export type Language = 'en' | 'es' | 'de' | 'fr' | 'it' | 'pt' | 'zh' | 'ja' | 'ko' | 'ru';

export interface Translations {
  // App
  appName: string;
  appDescription: string;
  
  // Navigation & Actions
  newEvent: string;
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
  
  // Views
  listView: string;
  calendarView: string;
  monthView: string;
  weekView: string;
  dayView: string;
  agendaView: string;
  
  // Event Form
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
  
  // Export Formats
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
  
  // Days short
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

// English (Default)
export const en: Translations = {
  appName: 'Calendar Event Generator',
  appDescription: 'Create events for Apple, Google & Microsoft calendars',
  
  newEvent: 'New Event',
  editEvent: 'Edit Event',
  deleteEvent: 'Delete Event',
  duplicateEvent: 'Duplicate Event',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  import: 'Import',
  export: 'Export',
  search: 'Search',
  filter: 'Filter',
  clear: 'Clear',
  clearAll: 'Clear All',
  undo: 'Undo',
  redo: 'Redo',
  
  listView: 'List',
  calendarView: 'Calendar',
  monthView: 'Month',
  weekView: 'Week',
  dayView: 'Day',
  agendaView: 'Agenda',
  
  eventTitle: 'Event Title',
  eventDescription: 'Description',
  location: 'Location',
  startDate: 'Start Date',
  endDate: 'End Date',
  allDay: 'All Day',
  timezone: 'Timezone',
  reminders: 'Reminders',
  addReminder: 'Add Reminder',
  recurrence: 'Recurrence',
  categories: 'Categories',
  url: 'URL',
  notes: 'Notes',
  attendees: 'Attendees',
  organizer: 'Organizer',
  status: 'Status',
  priority: 'Priority',
  color: 'Color',
  
  templates: 'Templates',
  useTemplate: 'Use Template',
  saveAsTemplate: 'Save as Template',
  importTemplate: 'Import Template',
  exportTemplate: 'Export Template',
  templateName: 'Template Name',
  noTemplates: 'No templates available',
  templateSaved: 'Template saved!',
  templateDeleted: 'Template deleted',
  customTemplates: 'Custom Templates',
  builtInTemplates: 'Built-in Templates',
  
  templateMeeting: 'Meeting',
  templateCall: 'Phone Call',
  templateLunch: 'Lunch',
  templateWorkout: 'Workout',
  templateFocus: 'Focus Time',
  templateBirthday: 'Birthday',
  templateReminder: 'Reminder',
  templateTravel: 'Travel',
  templateDeadline: 'Deadline',
  templateAppointment: 'Appointment',
  
  exportFormat: 'Export Format',
  exportICS: 'ICS (iCalendar)',
  exportJSON: 'JSON',
  exportMarkdown: 'Markdown',
  exportCSV: 'CSV',
  exportGoogleCalendar: 'Google Calendar',
  exportOutlook: 'Outlook Web',
  exportAppleCalendar: 'Apple Calendar',
  exportAll: 'Export All',
  exportSelected: 'Export Selected',
  
  importFile: 'Import File',
  importTemplateFile: 'Import Template',
  dragDropImport: 'Drag & drop files to import',
  
  quickActions: 'Quick Actions',
  typeToSearch: 'Type to search...',
  noResults: 'No results found',
  actions: 'Actions',
  events: 'Events',
  settings: 'Settings',
  
  language: 'Language',
  darkMode: 'Dark Mode',
  lightMode: 'Light Mode',
  theme: 'Theme',
  
  eventCreated: 'Event created!',
  eventUpdated: 'Event updated!',
  eventDeleted: 'Event deleted',
  eventDuplicated: 'Event duplicated!',
  eventsImported: 'events imported',
  exportSuccess: 'Export successful!',
  errorOccurred: 'An error occurred',
  confirmDelete: 'Are you sure you want to delete this event?',
  confirmClearAll: 'Are you sure you want to clear all events?',
  noEvents: 'No events',
  
  today: 'Today',
  tomorrow: 'Tomorrow',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  nextWeek: 'Next Week',
  thisMonth: 'This Month',
  
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
  
  january: 'January',
  february: 'February',
  march: 'March',
  april: 'April',
  may: 'May',
  june: 'June',
  july: 'July',
  august: 'August',
  september: 'September',
  october: 'October',
  november: 'November',
  december: 'December',
  
  features: 'Features',
  keyboardShortcuts: 'Keyboard Shortcuts',
  importExportICS: 'Import/Export ICS files',
  appleCalendarSupport: 'Apple Calendar extensions',
  googleCalendarSupport: 'Google Calendar links',
  outlookSupport: 'Microsoft Outlook support',
  recurringEvents: 'Recurring events (RRULE)',
  multipleReminders: 'Multiple reminders',
  timezoneSupport: 'Timezone support',
  geolocation: 'Geo-location for maps',
  allDayEvents: 'All-day events',
  eventCategories: 'Event categories/tags',
};

// Spanish
export const es: Translations = {
  appName: 'Generador de Eventos',
  appDescription: 'Crea eventos para calendarios de Apple, Google y Microsoft',
  
  newEvent: 'Nuevo Evento',
  editEvent: 'Editar Evento',
  deleteEvent: 'Eliminar Evento',
  duplicateEvent: 'Duplicar Evento',
  save: 'Guardar',
  cancel: 'Cancelar',
  close: 'Cerrar',
  import: 'Importar',
  export: 'Exportar',
  search: 'Buscar',
  filter: 'Filtrar',
  clear: 'Limpiar',
  clearAll: 'Limpiar Todo',
  undo: 'Deshacer',
  redo: 'Rehacer',
  
  listView: 'Lista',
  calendarView: 'Calendario',
  monthView: 'Mes',
  weekView: 'Semana',
  dayView: 'Día',
  agendaView: 'Agenda',
  
  eventTitle: 'Título del Evento',
  eventDescription: 'Descripción',
  location: 'Ubicación',
  startDate: 'Fecha de Inicio',
  endDate: 'Fecha de Fin',
  allDay: 'Todo el Día',
  timezone: 'Zona Horaria',
  reminders: 'Recordatorios',
  addReminder: 'Añadir Recordatorio',
  recurrence: 'Recurrencia',
  categories: 'Categorías',
  url: 'URL',
  notes: 'Notas',
  attendees: 'Asistentes',
  organizer: 'Organizador',
  status: 'Estado',
  priority: 'Prioridad',
  color: 'Color',
  
  templates: 'Plantillas',
  useTemplate: 'Usar Plantilla',
  saveAsTemplate: 'Guardar como Plantilla',
  importTemplate: 'Importar Plantilla',
  exportTemplate: 'Exportar Plantilla',
  templateName: 'Nombre de Plantilla',
  noTemplates: 'No hay plantillas disponibles',
  templateSaved: '¡Plantilla guardada!',
  templateDeleted: 'Plantilla eliminada',
  customTemplates: 'Plantillas Personalizadas',
  builtInTemplates: 'Plantillas Predefinidas',
  
  templateMeeting: 'Reunión',
  templateCall: 'Llamada',
  templateLunch: 'Almuerzo',
  templateWorkout: 'Ejercicio',
  templateFocus: 'Tiempo de Enfoque',
  templateBirthday: 'Cumpleaños',
  templateReminder: 'Recordatorio',
  templateTravel: 'Viaje',
  templateDeadline: 'Fecha Límite',
  templateAppointment: 'Cita',
  
  exportFormat: 'Formato de Exportación',
  exportICS: 'ICS (iCalendar)',
  exportJSON: 'JSON',
  exportMarkdown: 'Markdown',
  exportCSV: 'CSV',
  exportGoogleCalendar: 'Google Calendar',
  exportOutlook: 'Outlook Web',
  exportAppleCalendar: 'Apple Calendar',
  exportAll: 'Exportar Todo',
  exportSelected: 'Exportar Seleccionado',
  
  importFile: 'Importar Archivo',
  importTemplateFile: 'Importar Plantilla',
  dragDropImport: 'Arrastra archivos para importar',
  
  quickActions: 'Acciones Rápidas',
  typeToSearch: 'Escribe para buscar...',
  noResults: 'Sin resultados',
  actions: 'Acciones',
  events: 'Eventos',
  settings: 'Configuración',
  
  language: 'Idioma',
  darkMode: 'Modo Oscuro',
  lightMode: 'Modo Claro',
  theme: 'Tema',
  
  eventCreated: '¡Evento creado!',
  eventUpdated: '¡Evento actualizado!',
  eventDeleted: 'Evento eliminado',
  eventDuplicated: '¡Evento duplicado!',
  eventsImported: 'eventos importados',
  exportSuccess: '¡Exportación exitosa!',
  errorOccurred: 'Ocurrió un error',
  confirmDelete: '¿Estás seguro de eliminar este evento?',
  confirmClearAll: '¿Estás seguro de eliminar todos los eventos?',
  noEvents: 'Sin eventos',
  
  today: 'Hoy',
  tomorrow: 'Mañana',
  yesterday: 'Ayer',
  thisWeek: 'Esta Semana',
  nextWeek: 'Próxima Semana',
  thisMonth: 'Este Mes',
  
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
  
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
  
  january: 'Enero',
  february: 'Febrero',
  march: 'Marzo',
  april: 'Abril',
  may: 'Mayo',
  june: 'Junio',
  july: 'Julio',
  august: 'Agosto',
  september: 'Septiembre',
  october: 'Octubre',
  november: 'Noviembre',
  december: 'Diciembre',
  
  features: 'Características',
  keyboardShortcuts: 'Atajos de Teclado',
  importExportICS: 'Importar/Exportar ICS',
  appleCalendarSupport: 'Soporte Apple Calendar',
  googleCalendarSupport: 'Enlaces Google Calendar',
  outlookSupport: 'Soporte Microsoft Outlook',
  recurringEvents: 'Eventos recurrentes (RRULE)',
  multipleReminders: 'Múltiples recordatorios',
  timezoneSupport: 'Soporte de zona horaria',
  geolocation: 'Geolocalización para mapas',
  allDayEvents: 'Eventos de todo el día',
  eventCategories: 'Categorías de eventos',
};

// German
export const de: Translations = {
  appName: 'Kalender-Event-Generator',
  appDescription: 'Erstellen Sie Events für Apple, Google & Microsoft Kalender',
  
  newEvent: 'Neues Event',
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
  
  listView: 'Liste',
  calendarView: 'Kalender',
  monthView: 'Monat',
  weekView: 'Woche',
  dayView: 'Tag',
  agendaView: 'Agenda',
  
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
  
  importFile: 'Datei importieren',
  importTemplateFile: 'Vorlage importieren',
  dragDropImport: 'Dateien zum Importieren ablegen',
  
  quickActions: 'Schnellaktionen',
  typeToSearch: 'Zum Suchen tippen...',
  noResults: 'Keine Ergebnisse',
  actions: 'Aktionen',
  events: 'Events',
  settings: 'Einstellungen',
  
  language: 'Sprache',
  darkMode: 'Dunkelmodus',
  lightMode: 'Hellmodus',
  theme: 'Thema',
  
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
  
  today: 'Heute',
  tomorrow: 'Morgen',
  yesterday: 'Gestern',
  thisWeek: 'Diese Woche',
  nextWeek: 'Nächste Woche',
  thisMonth: 'Dieser Monat',
  
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
  
  mon: 'Mo',
  tue: 'Di',
  wed: 'Mi',
  thu: 'Do',
  fri: 'Fr',
  sat: 'Sa',
  sun: 'So',
  
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

// French
export const fr: Translations = {
  appName: 'Générateur d\'Événements',
  appDescription: 'Créez des événements pour Apple, Google et Microsoft',
  
  newEvent: 'Nouvel Événement',
  editEvent: 'Modifier l\'Événement',
  deleteEvent: 'Supprimer l\'Événement',
  duplicateEvent: 'Dupliquer l\'Événement',
  save: 'Enregistrer',
  cancel: 'Annuler',
  close: 'Fermer',
  import: 'Importer',
  export: 'Exporter',
  search: 'Rechercher',
  filter: 'Filtrer',
  clear: 'Effacer',
  clearAll: 'Tout Effacer',
  undo: 'Annuler',
  redo: 'Rétablir',
  
  listView: 'Liste',
  calendarView: 'Calendrier',
  monthView: 'Mois',
  weekView: 'Semaine',
  dayView: 'Jour',
  agendaView: 'Agenda',
  
  eventTitle: 'Titre de l\'Événement',
  eventDescription: 'Description',
  location: 'Lieu',
  startDate: 'Date de Début',
  endDate: 'Date de Fin',
  allDay: 'Toute la Journée',
  timezone: 'Fuseau Horaire',
  reminders: 'Rappels',
  addReminder: 'Ajouter un Rappel',
  recurrence: 'Récurrence',
  categories: 'Catégories',
  url: 'URL',
  notes: 'Notes',
  attendees: 'Participants',
  organizer: 'Organisateur',
  status: 'Statut',
  priority: 'Priorité',
  color: 'Couleur',
  
  templates: 'Modèles',
  useTemplate: 'Utiliser le Modèle',
  saveAsTemplate: 'Enregistrer comme Modèle',
  importTemplate: 'Importer un Modèle',
  exportTemplate: 'Exporter le Modèle',
  templateName: 'Nom du Modèle',
  noTemplates: 'Aucun modèle disponible',
  templateSaved: 'Modèle enregistré!',
  templateDeleted: 'Modèle supprimé',
  customTemplates: 'Modèles Personnalisés',
  builtInTemplates: 'Modèles Intégrés',
  
  templateMeeting: 'Réunion',
  templateCall: 'Appel Téléphonique',
  templateLunch: 'Déjeuner',
  templateWorkout: 'Entraînement',
  templateFocus: 'Temps de Concentration',
  templateBirthday: 'Anniversaire',
  templateReminder: 'Rappel',
  templateTravel: 'Voyage',
  templateDeadline: 'Date Limite',
  templateAppointment: 'Rendez-vous',
  
  exportFormat: 'Format d\'Export',
  exportICS: 'ICS (iCalendar)',
  exportJSON: 'JSON',
  exportMarkdown: 'Markdown',
  exportCSV: 'CSV',
  exportGoogleCalendar: 'Google Agenda',
  exportOutlook: 'Outlook Web',
  exportAppleCalendar: 'Apple Calendrier',
  exportAll: 'Tout Exporter',
  exportSelected: 'Exporter la Sélection',
  
  importFile: 'Importer un Fichier',
  importTemplateFile: 'Importer un Modèle',
  dragDropImport: 'Glissez-déposez pour importer',
  
  quickActions: 'Actions Rapides',
  typeToSearch: 'Tapez pour rechercher...',
  noResults: 'Aucun résultat',
  actions: 'Actions',
  events: 'Événements',
  settings: 'Paramètres',
  
  language: 'Langue',
  darkMode: 'Mode Sombre',
  lightMode: 'Mode Clair',
  theme: 'Thème',
  
  eventCreated: 'Événement créé!',
  eventUpdated: 'Événement mis à jour!',
  eventDeleted: 'Événement supprimé',
  eventDuplicated: 'Événement dupliqué!',
  eventsImported: 'événements importés',
  exportSuccess: 'Export réussi!',
  errorOccurred: 'Une erreur est survenue',
  confirmDelete: 'Voulez-vous vraiment supprimer cet événement?',
  confirmClearAll: 'Voulez-vous vraiment supprimer tous les événements?',
  noEvents: 'Aucun événement',
  
  today: 'Aujourd\'hui',
  tomorrow: 'Demain',
  yesterday: 'Hier',
  thisWeek: 'Cette Semaine',
  nextWeek: 'Semaine Prochaine',
  thisMonth: 'Ce Mois',
  
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
  
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mer',
  thu: 'Jeu',
  fri: 'Ven',
  sat: 'Sam',
  sun: 'Dim',
  
  january: 'Janvier',
  february: 'Février',
  march: 'Mars',
  april: 'Avril',
  may: 'Mai',
  june: 'Juin',
  july: 'Juillet',
  august: 'Août',
  september: 'Septembre',
  october: 'Octobre',
  november: 'Novembre',
  december: 'Décembre',
  
  features: 'Fonctionnalités',
  keyboardShortcuts: 'Raccourcis Clavier',
  importExportICS: 'Import/Export ICS',
  appleCalendarSupport: 'Support Apple Calendrier',
  googleCalendarSupport: 'Liens Google Agenda',
  outlookSupport: 'Support Microsoft Outlook',
  recurringEvents: 'Événements récurrents (RRULE)',
  multipleReminders: 'Rappels multiples',
  timezoneSupport: 'Support des fuseaux horaires',
  geolocation: 'Géolocalisation pour cartes',
  allDayEvents: 'Événements journée entière',
  eventCategories: 'Catégories d\'événements',
};

// All translations
export const translations: Record<Language, Translations> = {
  en,
  es,
  de,
  fr,
  it: en, // Fallback to English - can be expanded
  pt: en, // Fallback to English - can be expanded
  zh: en, // Fallback to English - can be expanded
  ja: en, // Fallback to English - can be expanded
  ko: en, // Fallback to English - can be expanded
  ru: en, // Fallback to English - can be expanded
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
