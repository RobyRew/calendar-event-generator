/**
 * Calendar Event Generator - Main Application
 * A comprehensive calendar event generator supporting Apple, Google, and Microsoft calendars
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarProvider, useCalendar } from '@/context';
import { Header, EventForm, EventList, ImportExportPanel, Card, Alert } from '@/components';
import { CalendarEvent } from '@/types';
import { parseICSFile } from '@/lib';

function CalendarApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);

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

  // Get selected event
  const selectedEvent = useMemo(() => {
    return state.calendar.events.find(e => e.uid === state.selectedEventId) || null;
  }, [state.calendar.events, state.selectedEventId]);

  // Handlers
  const handleNewEvent = () => {
    const newEvent = createNewEvent();
    setEditingEvent(newEvent);
    setShowEventForm(true);
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
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Drop ICS files here</h3>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Event List */}
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
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                    Events ({state.calendar.events.length})
                  </h2>
                </div>
                <EventList
                  events={state.calendar.events}
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
                ⌨️ Quick Tips
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                <li>• Drag & drop .ics files to import</li>
                <li>• Add coordinates for map links</li>
                <li>• Use categories for organization</li>
                <li>• Set multiple reminders per event</li>
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
