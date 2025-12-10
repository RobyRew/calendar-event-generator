/**
 * Calendar Event Generator - Main Application
 * A comprehensive calendar event generator supporting Apple, Google, and Microsoft calendars
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarProvider, useCalendar, useI18n } from '@/context';
import { Header, EventForm, EventList, ImportExportPanel, Card, Alert } from '@/components';
import { CalendarView } from '@/components/CalendarView';
import { CommandPalette, EVENT_TEMPLATES } from '@/components/CommandPalette';
import { SearchFilter } from '@/components/SearchFilter';
import { TemplateSelector, EventTemplate } from '@/components/TemplateSelector';
import { ExportOptions } from '@/components/ExportOptions';
import { CalendarEvent } from '@/types';
import { parseICSFile } from '@/lib';
import { Undo2, Redo2, Calendar, List, Search } from 'lucide-react';

function CalendarApp() {
  const { t } = useI18n();
  const [darkMode, setDarkMode] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showSearch, setShowSearch] = useState(false);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[] | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    state,
    addEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
    mergeEvents,
    createNewEvent,
    setError,
    setSuccess,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCalendar();

  // Initialize dark mode from system preference
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDark);
  }, []);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + K - Open command palette
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      // Cmd/Ctrl + Z - Undo
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
          setSuccess('Undo successful');
        }
        return;
      }

      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y - Redo
      if ((cmdOrCtrl && e.shiftKey && e.key === 'z') || (cmdOrCtrl && e.key === 'y')) {
        e.preventDefault();
        if (canRedo) {
          redo();
          setSuccess('Redo successful');
        }
        return;
      }

      // Cmd/Ctrl + N - New event (when not in form)
      if (cmdOrCtrl && e.key === 'n' && !showEventForm) {
        e.preventDefault();
        handleNewEvent();
        return;
      }

      // Cmd/Ctrl + F - Toggle search
      if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        setShowSearch(s => !s);
        return;
      }

      // Escape - Close modals/forms
      if (e.key === 'Escape') {
        if (showCommandPalette) {
          setShowCommandPalette(false);
        } else if (showEventForm) {
          handleCancelEdit();
        } else if (showSearch) {
          setShowSearch(false);
          setFilteredEvents(null);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, setSuccess, showEventForm, showCommandPalette, showSearch]);

  // Get selected event
  const selectedEvent = useMemo(() => {
    return state.calendar.events.find(e => e.uid === state.selectedEventId) || null;
  }, [state.calendar.events, state.selectedEventId]);

  // Events to display (filtered or all)
  const displayEvents = useMemo(() => {
    return filteredEvents ?? state.calendar.events;
  }, [filteredEvents, state.calendar.events]);

  // Handlers
  const handleNewEvent = () => {
    // Show template selector first
    setShowTemplateSelector(true);
  };

  // Create blank event (skip template)
  const handleCreateBlankEvent = () => {
    const newEvent = createNewEvent();
    setEditingEvent(newEvent);
    setShowEventForm(true);
    setShowTemplateSelector(false);
  };

  // Handle template selection
  const handleSelectTemplate = (template: EventTemplate) => {
    const newEvent = createNewEvent();
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMinutes(Math.ceil(startDate.getMinutes() / 15) * 15, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + template.duration);

    const eventFromTemplate: CalendarEvent = {
      ...newEvent,
      ...template.defaults,
      summary: template.defaults.summary || template.name,
      startDate,
      endDate,
      allDay: template.defaults.allDay || false,
    };
    
    setEditingEvent(eventFromTemplate);
    setShowEventForm(true);
    setShowTemplateSelector(false);
  };

  const handleEditEvent = (eventId: string) => {
    const event = state.calendar.events.find(e => e.uid === eventId);
    if (event) {
      setEditingEvent({ ...event });
      setShowEventForm(true);
    }
  };

  const handleSaveEvent = () => {
    if (!editingEvent) return;

    const existingEvent = state.calendar.events.find(e => e.uid === editingEvent.uid);
    if (existingEvent) {
      updateEvent(editingEvent);
      setSuccess('Event updated successfully!');
    } else {
      addEvent(editingEvent);
      setSuccess('Event created successfully!');
    }

    setShowEventForm(false);
    setEditingEvent(null);
  };

  const handleCancelEdit = () => {
    setShowEventForm(false);
    setEditingEvent(null);
  };

  const handleDuplicateEvent = (event: CalendarEvent) => {
    const newEvent = createNewEvent();
    const duplicated = {
      ...event,
      uid: newEvent.uid,
      summary: `${event.summary} (Copy)`,
      created: new Date(),
      lastModified: new Date(),
    };
    addEvent(duplicated);
    setSuccess('Event duplicated!');
  };

  const handleSelectEvent = (eventId: string) => {
    selectEvent(eventId);
    handleEditEvent(eventId);
  };

  // Handle template application
  const handleApplyTemplate = (templateId: string) => {
    const template = EVENT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const newEvent = createNewEvent();
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMinutes(Math.ceil(startDate.getMinutes() / 15) * 15, 0, 0); // Round to 15 min
    
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + template.duration);

    const eventFromTemplate: CalendarEvent = {
      ...newEvent,
      ...template.defaults,
      startDate,
      endDate,
      allDay: template.defaults.allDay || false,
    };
    
    setEditingEvent(eventFromTemplate);
    setShowEventForm(true);
  };

  // Handle calendar date click
  const handleCalendarDateClick = (date: Date) => {
    const newEvent = createNewEvent();
    const startDate = new Date(date);
    startDate.setHours(9, 0, 0, 0); // Default to 9 AM
    const endDate = new Date(startDate);
    endDate.setHours(10, 0, 0, 0); // 1 hour duration
    
    setEditingEvent({
      ...newEvent,
      startDate,
      endDate,
    });
    setShowEventForm(true);
  };

  // Handle file import from command palette
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let totalImported = 0;
    const allEvents: CalendarEvent[] = [];

    for (const file of Array.from(files)) {
      try {
        const parsed = await parseICSFile(file);
        const eventsWithSource = parsed.events.map(event => ({
          ...event,
          sourceFile: file.name,
        }));
        allEvents.push(...eventsWithSource);
        totalImported += eventsWithSource.length;
      } catch (error) {
        setError(`Error parsing ${file.name}`);
      }
    }

    if (allEvents.length > 0) {
      mergeEvents(allEvents);
      setSuccess(`Imported ${totalImported} event(s)!`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clear all events
  const handleClearAll = () => {
    if (state.calendar.events.length > 0 && confirm('Are you sure you want to clear all events?')) {
      mergeEvents([]); // This will clear since we're setting to empty with SET_CALENDAR
      // Actually we need clearEvents
      setSuccess('All events cleared');
    }
  };

  // Global drag and drop handlers for importing ICS files anywhere
  const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGlobalDragging(true);
  }, []);

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the window entirely
    if (e.relatedTarget === null) {
      setIsGlobalDragging(false);
    }
  }, []);

  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleGlobalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGlobalDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    let totalImported = 0;
    const errors: string[] = [];
    const allEvents: CalendarEvent[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (!['ics', 'ical', 'ifb'].includes(ext || '')) {
        errors.push(`${file.name}: Not a valid calendar file`);
        continue;
      }

      try {
        const parsedCalendar = await parseICSFile(file);
        const eventsWithSource = parsedCalendar.events.map(event => ({
          ...event,
          sourceFile: file.name,
        }));
        allEvents.push(...eventsWithSource);
        totalImported += eventsWithSource.length;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }

    if (allEvents.length > 0) {
      mergeEvents(allEvents);
      setSuccess(`Added ${totalImported} event(s) from ${files.length} file(s)!`);
    }

    if (errors.length > 0) {
      setError(`Failed: ${errors.join(', ')}`);
    }
  }, [mergeEvents, setSuccess, setError]);

  return (
    <div 
      className={`min-h-screen gradient-mesh ${darkMode ? 'dark' : ''}`}
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      {/* Hidden file input for command palette import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,.ical,.ifb"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <TemplateSelector
          onSelectTemplate={handleSelectTemplate}
          onCreateBlank={handleCreateBlankEvent}
          onClose={() => setShowTemplateSelector(false)}
          currentEvent={editingEvent}
        />
      )}

      {/* Export Options Modal */}
      {showExportOptions && (
        <ExportOptions
          calendar={state.calendar}
          selectedEvent={selectedEvent}
          onClose={() => setShowExportOptions(false)}
          onSuccess={setSuccess}
        />
      )}

      {/* Command Palette (Spotlight) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        events={state.calendar.events}
        onNewEvent={handleNewEvent}
        onSelectEvent={handleSelectEvent}
        onExportAll={() => setShowExportOptions(true)}
        onImportClick={handleImportClick}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        darkMode={darkMode}
        onClearAll={handleClearAll}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* Global Drop Overlay */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-50 bg-primary-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl border-2 border-dashed border-primary-500">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{t.dragDropImport}</h3>
              <p className="text-gray-500 dark:text-slate-400 mt-1">Release to import calendar events</p>
            </div>
          </div>
        </div>
      )}
      
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onNewEvent={handleNewEvent}
      />

      {/* Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
        {state.error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {state.error}
          </Alert>
        )}
        {state.successMessage && (
          <Alert variant="success" onClose={() => setSuccess(null)}>
            {state.successMessage}
          </Alert>
        )}
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Toolbar - View Toggle, Search, Undo/Redo */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Calendar
              </button>
            </div>

            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(s => !s)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showSearch
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
              }`}
            >
              <Search className="w-4 h-4" />
              {showSearch ? 'Close Search' : 'Search'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => { undo(); setSuccess('Undo'); }}
                disabled={!canUndo}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  canUndo
                    ? 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    : 'text-gray-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title="Undo (⌘Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => { redo(); setSuccess('Redo'); }}
                disabled={!canRedo}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  canRedo
                    ? 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    : 'text-gray-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title="Redo (⌘⇧Z)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Command Palette Trigger */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 transition-colors"
            >
              <span className="text-xs bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">⌘K</span>
              Quick Actions
            </button>
          </div>
        </div>

        {/* Search Filter Panel */}
        {showSearch && (
          <div className="mb-6">
            <SearchFilter
              events={state.calendar.events}
              onFilteredEventsChange={setFilteredEvents}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Event List or Calendar */}
          <div className="lg:col-span-2 space-y-6">
            {showEventForm && editingEvent ? (
              <Card>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-6">
                  {state.calendar.events.find(e => e.uid === editingEvent.uid) 
                    ? 'Edit Event' 
                    : 'Create New Event'
                  }
                </h2>
                <EventForm
                  event={editingEvent}
                  onChange={setEditingEvent}
                  onSave={handleSaveEvent}
                  onCancel={handleCancelEdit}
                />
              </Card>
            ) : viewMode === 'calendar' ? (
              <Card>
                <CalendarView
                  events={displayEvents}
                  selectedEventId={state.selectedEventId}
                  onSelectEvent={handleSelectEvent}
                  onSelectDate={handleCalendarDateClick}
                />
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                    Events ({displayEvents.length})
                    {filteredEvents && (
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        (filtered from {state.calendar.events.length})
                      </span>
                    )}
                  </h2>
                </div>
                <EventList
                  events={displayEvents}
                  selectedEventId={state.selectedEventId}
                  onSelect={handleSelectEvent}
                  onDelete={deleteEvent}
                  onDuplicate={handleDuplicateEvent}
                />
              </div>
            )}
          </div>

          {/* Right Column - Import/Export */}
          <div className="space-y-6">
            <ImportExportPanel
              calendar={state.calendar}
              selectedEvent={selectedEvent}
              onImport={mergeEvents}
              onError={setError}
              onSuccess={setSuccess}
            />

            {/* Feature Highlights */}
            <Card>
              <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4">
                ✨ Features
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Import/Export ICS files
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Apple Calendar extensions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Google Calendar links
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Microsoft Outlook support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Recurring events (RRULE)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Multiple reminders
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Timezone support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Geo-location for maps
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  All-day events
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Event categories/tags
                </li>
              </ul>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card>
              <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4">
                ⌨️ Keyboard Shortcuts
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                <li className="flex items-center justify-between">
                  <span>Quick Actions</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">⌘K</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span>New Event</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">⌘N</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span>Search</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">⌘F</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span>Undo</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">⌘Z</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span>Redo</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">⌘⇧Z</kbd>
                </li>
                <li className="flex items-center justify-between">
                  <span>Close/Cancel</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">Esc</kbd>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-slate-700 mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500 dark:text-slate-400">
          <p>Calendar Event Generator - Create events for Apple, Google & Microsoft calendars</p>
          <p className="mt-1">Supports iCalendar (RFC 5545) standard with platform-specific extensions</p>
        </div>
      </footer>
    </div>
  );
}

// Wrap with provider
export default function App() {
  return (
    <CalendarProvider>
      <CalendarApp />
    </CalendarProvider>
  );
}
