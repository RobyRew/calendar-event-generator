/**
 * Calendar Event Generator - Main Application
 * A comprehensive calendar event generator supporting Apple, Google, and Microsoft calendars
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarProvider, useCalendar, useI18n } from '@/context';
import { Header, EventList, Card, Alert } from '@/components';
import { EventForm as EventFormAccordion } from '@/components/EventFormAccordion';
import { CalendarView } from '@/components/CalendarView';
import { CommandPalette } from '@/components/CommandPalette';
import { NewEventModal, EventTemplate } from '@/components/NewEventModal';
import { ExportOptions } from '@/components/ExportOptions';
import { CalendarEvent } from '@/types';
import { parseICSFile, generateEventICS, downloadICS } from '@/lib';
import { Undo2, Redo2, Calendar, List, Search, Download, Plus, X, FileText } from 'lucide-react';
import { ThemeId, THEMES } from '@/styles/themes';

function CalendarApp() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<ThemeId>('light');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showNewEventModal, setShowNewEventModal] = useState(false);
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

  // Initialize theme from system preference
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  // Apply theme class
  useEffect(() => {
    // Remove all theme classes
    THEMES.forEach(t => {
      document.documentElement.classList.remove(t.className);
    });
    // Add current theme class
    const themeConfig = THEMES.find(t => t.id === theme) || THEMES[0];
    document.documentElement.classList.add(themeConfig.className);
  }, [theme]);

  // Theme change handler
  const handleThemeChange = (newTheme: ThemeId) => {
    setTheme(newTheme);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
          setSuccess('Undo successful');
        }
        return;
      }

      if ((cmdOrCtrl && e.shiftKey && e.key === 'z') || (cmdOrCtrl && e.key === 'y')) {
        e.preventDefault();
        if (canRedo) {
          redo();
          setSuccess('Redo successful');
        }
        return;
      }

      if (cmdOrCtrl && e.key === 'n' && !showEventForm) {
        e.preventDefault();
        setShowNewEventModal(true);
        return;
      }

      if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      if (e.key === 'Escape') {
        if (showCommandPalette) {
          setShowCommandPalette(false);
        } else if (showNewEventModal) {
          setShowNewEventModal(false);
        } else if (showEventForm) {
          handleCancelEdit();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, setSuccess, showEventForm, showCommandPalette, showNewEventModal]);

  const selectedEvent = useMemo(() => {
    return state.calendar.events.find(e => e.uid === state.selectedEventId) || null;
  }, [state.calendar.events, state.selectedEventId]);

  const displayEvents = useMemo(() => {
    return state.calendar.events;
  }, [state.calendar.events]);

  const handleCreateBlankEvent = () => {
    const newEvent = createNewEvent();
    setEditingEvent(newEvent);
    setShowEventForm(true);
    setShowNewEventModal(false);
  };

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
    setShowNewEventModal(false);
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
      const updatedEvent = {
        ...editingEvent,
        lastModified: new Date(),
      };
      updateEvent(updatedEvent);
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
      sourceFile: undefined,
    };
    addEvent(duplicated);
    setSuccess('Event duplicated!');
  };

  const handleSelectEvent = (eventId: string) => {
    selectEvent(eventId);
    handleEditEvent(eventId);
  };

  const handleCalendarDateClick = (date: Date) => {
    const newEvent = createNewEvent();
    const startDate = new Date(date);
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(10, 0, 0, 0);
    
    setEditingEvent({
      ...newEvent,
      startDate,
      endDate,
    });
    setShowEventForm(true);
  };

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
      } catch {
        setError(`Error parsing ${file.name}`);
      }
    }

    if (allEvents.length > 0) {
      mergeEvents(allEvents);
      setSuccess(`Imported ${totalImported} event(s)!`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearAll = () => {
    if (state.calendar.events.length > 0 && confirm('Are you sure you want to clear all events?')) {
      mergeEvents([]);
      setSuccess('All events cleared');
    }
  };

  const handleQuickExportSelected = () => {
    if (!selectedEvent) {
      setError(t.noEventSelected || 'No event selected');
      return;
    }
    const content = generateEventICS(selectedEvent);
    const filename = `${selectedEvent.summary.replace(/[^a-z0-9]/gi, '_')}.ics`;
    downloadICS(content, filename);
    setSuccess(t.exportSuccess || 'Export successful!');
  };

  const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGlobalDragging(true);
  }, []);

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Parse error'}`);
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
      className={`min-h-screen min-h-[100dvh] gradient-mesh ${theme !== 'light' ? theme : ''}`}
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,.ical,.ifb"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      <NewEventModal
        isOpen={showNewEventModal}
        onClose={() => setShowNewEventModal(false)}
        onCreateBlank={handleCreateBlankEvent}
        onSelectTemplate={handleSelectTemplate}
        onImportClick={handleImportClick}
        currentEvent={editingEvent}
      />

      {showExportOptions && (
        <ExportOptions
          calendar={state.calendar}
          selectedEvent={selectedEvent}
          onClose={() => setShowExportOptions(false)}
          onSuccess={setSuccess}
        />
      )}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        events={state.calendar.events}
        onNewEvent={() => setShowNewEventModal(true)}
        onSelectEvent={handleSelectEvent}
        onExportAll={() => setShowExportOptions(true)}
        onImportClick={handleImportClick}
        onChangeTheme={handleThemeChange}
        theme={theme}
        onClearAll={handleClearAll}
      />

      {isGlobalDragging && (
        <div className="fixed inset-0 z-50 bg-[rgb(var(--primary)/0.2)] backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-[rgb(var(--card))] rounded-2xl p-8 shadow-2xl border-2 border-dashed border-[rgb(var(--primary))]">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgb(var(--accent))] flex items-center justify-center">
                <svg className="w-8 h-8 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[rgb(var(--foreground))]">{t.dragDropImport}</h3>
              <p className="text-[rgb(var(--muted-foreground))] mt-1">{t.releaseToImport}</p>
            </div>
          </div>
        </div>
      )}
      
      <Header
        theme={theme}
        onChangeTheme={handleThemeChange}
      />

      <div className="fixed top-16 right-2 sm:right-4 z-50 space-y-2 max-w-[90vw] sm:max-w-sm">
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

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center bg-[rgb(var(--card))] rounded-lg p-1 shadow-sm border border-[rgb(var(--border))]">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                  : 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--accent))]'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">{t.listView}</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                  : 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--accent))]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">{t.calendarView}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(canUndo || canRedo) && (
              <div className="flex items-center bg-[rgb(var(--card))] rounded-lg p-1 shadow-sm border border-[rgb(var(--border))]">
                <button
                  onClick={() => { undo(); setSuccess(t.undo); }}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-md transition-colors ${
                    canUndo
                      ? 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--accent))]'
                      : 'text-[rgb(var(--muted-foreground)/0.3)] cursor-not-allowed'
                  }`}
                  title="Undo (⌘Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { redo(); setSuccess(t.redo); }}
                  disabled={!canRedo}
                  className={`p-1.5 rounded-md transition-colors ${
                    canRedo
                      ? 'text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--accent))]'
                      : 'text-[rgb(var(--muted-foreground)/0.3)] cursor-not-allowed'
                  }`}
                  title="Redo (⌘⇧Z)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowExportOptions(true)}
              disabled={state.calendar.events.length === 0}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                state.calendar.events.length === 0
                  ? 'bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground)/0.3)] border-[rgb(var(--border))] cursor-not-allowed'
                  : 'bg-[rgb(var(--card))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent))] border-[rgb(var(--border))]'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t.export}</span>
            </button>

            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[rgb(var(--card))] rounded-lg text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--accent))] border border-[rgb(var(--border))] transition-colors"
            >
              <Search className="w-4 h-4" />
              <kbd className="hidden sm:inline text-xs bg-[rgb(var(--accent))] px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {showEventForm && editingEvent && (
            <div className="lg:col-span-5 xl:col-span-4 order-first">
              <Card className="sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[rgb(var(--foreground))]">
                    {state.calendar.events.find(e => e.uid === editingEvent.uid) 
                      ? t.editEvent
                      : t.newEvent
                    }
                  </h2>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 hover:bg-[rgb(var(--accent))] rounded-lg transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-[rgb(var(--muted-foreground))]" />
                  </button>
                </div>
                <EventFormAccordion
                  event={editingEvent}
                  onChange={setEditingEvent}
                  onSave={handleSaveEvent}
                  onCancel={handleCancelEdit}
                />
              </Card>
            </div>
          )}
          
          <div className={`${showEventForm ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'}`}>
            {viewMode === 'calendar' ? (
              <Card>
                <CalendarView
                  events={displayEvents}
                  selectedEventId={state.selectedEventId}
                  onSelectEvent={handleSelectEvent}
                  onSelectDate={handleCalendarDateClick}
                />
              </Card>
            ) : displayEvents.length > 0 ? (
              <EventList
                events={displayEvents}
                selectedEventId={state.selectedEventId}
                onSelect={handleSelectEvent}
                onDelete={deleteEvent}
                onDuplicate={handleDuplicateEvent}
              />
            ) : (
              <Card className="text-center py-16">
                <Calendar className="w-16 h-16 mx-auto text-[rgb(var(--muted-foreground)/0.3)] mb-4" />
                <h3 className="text-xl font-semibold text-[rgb(var(--foreground))] mb-2">
                  {t.noEvents}
                </h3>
                <p className="text-[rgb(var(--muted-foreground))] mb-6 max-w-sm mx-auto">
                  {t.createFirstEvent}
                </p>
                <button
                  onClick={() => setShowNewEventModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-xl hover:opacity-90 transition-opacity font-medium"
                >
                  <Plus className="w-5 h-5" />
                  {t.newEvent}
                </button>
              </Card>
            )}
          </div>

          {!showEventForm && displayEvents.length > 0 && (
            <div className="hidden xl:block xl:col-span-3 space-y-4">
              <Card>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[rgb(var(--primary))]">{displayEvents.length}</div>
                  <div className="text-sm text-[rgb(var(--muted-foreground))]">
                    {displayEvents.length === 1 ? t.event : t.events}
                  </div>
                </div>
              </Card>

              {selectedEvent && (
                <Card>
                  <h3 className="font-medium text-[rgb(var(--foreground))] mb-3 flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-[rgb(var(--primary))]" />
                    {t.selectedEvent}
                  </h3>
                  <div className="p-3 bg-[rgb(var(--accent))] rounded-lg">
                    <p className="font-medium text-[rgb(var(--foreground))] truncate text-sm">
                      {selectedEvent.summary}
                    </p>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                      {selectedEvent.allDay 
                        ? new Date(selectedEvent.startDate).toLocaleDateString()
                        : new Date(selectedEvent.startDate).toLocaleString()
                      }
                    </p>
                    {selectedEvent.sourceFile && (
                      <p className="text-xs text-[rgb(var(--muted-foreground)/0.7)] mt-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {selectedEvent.sourceFile}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleQuickExportSelected}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-lg text-sm hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-4 h-4" />
                    {t.export}
                  </button>
                </Card>
              )}

              <Card>
                <h3 className="font-medium text-[rgb(var(--foreground))] mb-3 text-sm">
                  ⌨️ {t.shortcuts}
                </h3>
                <div className="space-y-2 text-xs text-[rgb(var(--muted-foreground))]">
                  <div className="flex items-center justify-between">
                    <span>{t.searchCommands}</span>
                    <kbd className="px-1.5 py-0.5 bg-[rgb(var(--accent))] rounded">⌘K</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t.newEvent}</span>
                    <kbd className="px-1.5 py-0.5 bg-[rgb(var(--accent))] rounded">⌘N</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t.undo}</span>
                    <kbd className="px-1.5 py-0.5 bg-[rgb(var(--accent))] rounded">⌘Z</kbd>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-4 right-4 sm:hidden z-40 safe-area-bottom">
        <button
          onClick={() => setShowNewEventModal(true)}
          className="w-14 h-14 bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center touch-manipulation"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="hidden sm:block fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowNewEventModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all font-medium touch-manipulation"
        >
          <Plus className="w-5 h-5" />
          {t.newEvent}
        </button>
      </div>

      <footer className="hidden sm:block border-t border-[rgb(var(--border))] mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-[rgb(var(--muted-foreground))]">
          <p>{t.footerText}</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <CalendarProvider>
      <CalendarApp />
    </CalendarProvider>
  );
}
