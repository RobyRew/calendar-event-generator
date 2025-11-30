/**
 * Calendar Event Generator - Main Application
 * A comprehensive calendar event generator supporting Apple, Google, and Microsoft calendars
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CalendarProvider, useCalendar } from '@/context';
import { Header, EventForm, EventList, ImportExportPanel, Card, Alert } from '@/components';
import { CalendarEvent } from '@/types';

function CalendarApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const {
    state,
    addEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
    setCalendar,
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

  return (
    <div className={`min-h-screen gradient-mesh ${darkMode ? 'dark' : ''}`}>
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
              onImport={setCalendar}
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
