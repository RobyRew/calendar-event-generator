/**
 * French translations
 */

import type { Translations } from '../translations';

export const fr: Translations = {
  // App
  appName: 'Générateur d\'Événements',
  appDescription: 'Créez des événements pour Apple, Google et Microsoft',
  
  // Actions
  newEvent: 'Nouvel Événement',
  newBlankEvent: 'Nouvel Événement Vide',
  newFromTemplate: 'Depuis un Modèle...',
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
  edit: 'Modifier',
  duplicate: 'Dupliquer',
  delete: 'Supprimer',
  
  // Import/Export
  importICS: 'Importer un Fichier ICS',
  importFromFile: 'Importer depuis un Fichier',
  exportAllEvents: 'Exporter Tous les Événements',
  exportSelectedEvent: 'Exporter l\'Événement Sélectionné',
  exportOptions: 'Options d\'Exportation...',
  noEventSelected: 'Aucun événement sélectionné',
  selectedEventLabel: 'Événement Sélectionné:',
  releaseToImport: 'Relâchez pour importer les événements',
  
  // Views
  listView: 'Liste',
  calendarView: 'Calendrier',
  monthView: 'Mois',
  weekView: 'Semaine',
  dayView: 'Jour',
  agendaView: 'Agenda',
  
  // Event Fields
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
  
  // Templates
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
  selectTemplate: 'Sélectionner un modèle...',
  createEvent: 'Créer depuis le Modèle',
  blank: 'Vide',
  modified: 'Modifié',
  fromFile: 'De:',
  expandAll: 'Tout Développer',
  collapseAll: 'Tout Réduire',
  verticalLayout: 'Vue Verticale',
  tabLayout: 'Vue Onglets',
  
  // Template Names
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
  
  // Export
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
  copyToClipboard: 'Copier dans le Presse-papiers',
  copiedToClipboard: 'Copié dans le presse-papiers!',
  openInBrowser: 'Ouvrir dans le Navigateur',
  
  // Import
  importFile: 'Importer un Fichier',
  importTemplateFile: 'Importer un Modèle',
  dragDropImport: 'Glissez-déposez pour importer',
  
  // Command Palette
  quickActions: 'Actions Rapides',
  typeToSearch: 'Tapez pour rechercher...',
  noResults: 'Aucun résultat',
  actions: 'Actions',
  events: 'Événements',
  settings: 'Paramètres',
  switchToTheme: 'Basculer vers',
  currentTheme: 'Actuel',
  
  // Settings
  language: 'Langue',
  darkMode: 'Mode Sombre',
  lightMode: 'Mode Clair',
  theme: 'Thème',
  
  // Theme names
  themeLight: 'Clair',
  themeDark: 'Sombre',
  themeOled: 'OLED',
  themeNeumorphic: 'Neumorphique',
  themeGlass: 'Verre Liquide',
  
  // Messages
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
  noEventsYet: 'Pas encore d\'événements',
  createFirstEvent: 'Créez votre premier événement ou importez des événements existants depuis un fichier ICS',
  allEventsCleared: 'Tous les événements supprimés',
  
  // Settings Panel
  appearance: 'Apparence',
  data: 'Données',
  localStorage: 'Stockage Local',
  clearAllData: 'Effacer Toutes les Données',
  clearDataDescription: 'Supprimer tous les événements et réinitialiser l\'app',
  confirmClearData: 'Êtes-vous sûr?',
  clearDataWarning: 'Cela supprimera définitivement tous vos événements. Cette action ne peut pas être annulée.',
  about: 'À propos',
  version: 'Version',
  
  // Sidebar
  selectedEvent: 'Événement Sélectionné',
  shortcuts: 'Raccourcis',
  searchCommands: 'Rechercher / Commandes',
  event: 'Événement',
  
  // Footer
  footerText: 'Générateur d\'Événements - Créez des événements pour Apple, Google et Microsoft',
  
  // Time
  today: 'Aujourd\'hui',
  tomorrow: 'Demain',
  yesterday: 'Hier',
  thisWeek: 'Cette Semaine',
  nextWeek: 'Semaine Prochaine',
  thisMonth: 'Ce Mois',
  
  // Days
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
  
  // Short Days
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mer',
  thu: 'Jeu',
  fri: 'Ven',
  sat: 'Sam',
  sun: 'Dim',
  
  // Months
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
  
  // Features
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
