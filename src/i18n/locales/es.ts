/**
 * Spanish translations
 */

import type { Translations } from '../translations';

export const es: Translations = {
  // App
  appName: 'Generador de Eventos',
  appDescription: 'Crea eventos para calendarios de Apple, Google y Microsoft',
  
  // Actions
  newEvent: 'Nuevo Evento',
  newBlankEvent: 'Nuevo Evento en Blanco',
  newFromTemplate: 'Desde Plantilla...',
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
  edit: 'Editar',
  duplicate: 'Duplicar',
  delete: 'Eliminar',
  
  // Import/Export
  importICS: 'Importar Archivo ICS',
  importFromFile: 'Importar desde Archivo',
  exportAllEvents: 'Exportar Todos los Eventos',
  exportSelectedEvent: 'Exportar Evento Seleccionado',
  exportOptions: 'Opciones de Exportación...',
  noEventSelected: 'Ningún evento seleccionado',
  selectedEventLabel: 'Evento Seleccionado:',
  releaseToImport: 'Suelta para importar eventos de calendario',
  
  // Views
  listView: 'Lista',
  calendarView: 'Calendario',
  monthView: 'Mes',
  weekView: 'Semana',
  dayView: 'Día',
  agendaView: 'Agenda',
  
  // Event Fields
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
  
  // Templates
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
  selectTemplate: 'Seleccionar plantilla...',
  createEvent: 'Crear desde Plantilla',
  blank: 'En Blanco',
  modified: 'Modificado',
  fromFile: 'De:',
  expandAll: 'Expandir Todo',
  collapseAll: 'Colapsar Todo',
  verticalLayout: 'Vista Vertical',
  tabLayout: 'Vista Pestañas',
  
  // Template Names
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
  
  // Export
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
  copyToClipboard: 'Copiar al Portapapeles',
  copiedToClipboard: '¡Copiado al portapapeles!',
  openInBrowser: 'Abrir en Navegador',
  
  // Import
  importFile: 'Importar Archivo',
  importTemplateFile: 'Importar Plantilla',
  dragDropImport: 'Arrastra archivos para importar',
  
  // Command Palette
  quickActions: 'Acciones Rápidas',
  typeToSearch: 'Escribe para buscar...',
  noResults: 'Sin resultados',
  actions: 'Acciones',
  events: 'Eventos',
  settings: 'Configuración',
  switchToTheme: 'Cambiar a',
  currentTheme: 'Actual',
  
  // Settings
  language: 'Idioma',
  darkMode: 'Modo Oscuro',
  lightMode: 'Modo Claro',
  theme: 'Tema',
  
  // Theme names
  themeLight: 'Claro',
  themeDark: 'Oscuro',
  themeOled: 'OLED',
  themeNeumorphic: 'Neumórfico',
  themeGlass: 'Cristal Líquido',
  
  // Messages
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
  noEventsYet: 'Aún no hay eventos',
  createFirstEvent: 'Crea tu primer evento de calendario o importa eventos existentes desde un archivo ICS',
  allEventsCleared: 'Todos los eventos eliminados',
  
  // Sidebar
  selectedEvent: 'Evento Seleccionado',
  shortcuts: 'Atajos',
  searchCommands: 'Buscar / Comandos',
  event: 'Evento',
  
  // Footer
  footerText: 'Generador de Eventos - Crea eventos para calendarios de Apple, Google y Microsoft',
  
  // Time
  today: 'Hoy',
  tomorrow: 'Mañana',
  yesterday: 'Ayer',
  thisWeek: 'Esta Semana',
  nextWeek: 'Próxima Semana',
  thisMonth: 'Este Mes',
  
  // Days
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
  
  // Short Days
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
  
  // Months
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
  
  // Features
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
