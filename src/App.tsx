/**
 * Calendar Event Generator - Main Application
 * A comprehensive calendar event generator supporting Apple, Google, and Microsoft calendars
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarProvider, useCalendar, useI18n } from '@/context';
import { Header, EventList, Card, Alert, Settings, Footer } from '@/components';
import { EventForm as EventFormAccordion } from '@/components/EventFormAccordion';
import { CalendarView } from '@/components/CalendarView';
import { CommandPalette } from '@/components/CommandPalette';
import { NewEventModal, EventTemplate } from '@/components/NewEventModal';
import { ExportOptions } from '@/components/ExportOptions';
import { CalendarEvent } from '@/types';
import { parseICSFile, generateEventICS, downloadICS, saveEvents, loadEvents, saveSettings, loadSettings, clearAllData, getStorageInfo } from '@/lib';
import { Undo2, Redo2, Calendar, List, Search, Download, Plus, X, FileText } from 'lucide-react';
import { ThemeId, THEMES } from '@/styles/themes';

function CalendarApp() {
  const { t, setLanguage, language } = useI18n();
  const [theme, setTheme] = useState<ThemeId>('light');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ used: '0 B', eventCount: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);

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
    clearEvents,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCalendar();

  // Load saved settings and events on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    
    const settings = loadSettings();
    setTheme(settings.theme as ThemeId || 'light');
    setViewMode(settings.viewMode || 'list');
    if (settings.language) {
      setLanguage(settings.language as 'en' | 'es' | 'de' | 'fr');
    }
    
    // Load saved events
    const savedEvents = loadEvents();
    if (savedEvents.length > 0) {
      mergeEvents(savedEvents);
    }
    
    // Update storage info
    setStorageInfo(getStorageInfo());
  }, [mergeEvents, setLanguage]);

  // Save events whenever they change
  useEffect(() => {
    if (initialLoadDone.current && state.calendar.events.length >= 0) {
      saveEvents(state.calendar.events);
      setStorageInfo(getStorageInfo());
    }
  }, [state.calendar.events]);

  // Save settings whenever theme, language, or viewMode changes
  useEffect(() => {
    if (initialLoadDone.current) {
      saveSettings({ theme, language, viewMode });
    }
  }, [theme, language, viewMode]);

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

  // Language change handler
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang as 'en' | 'es' | 'de' | 'fr');
  };

  // Clear all data handler
  const handleClearData = () => {
    clearAllData();
    clearEvents();
    setStorageInfo({ used: '0 B', eventCount: 0 });
    setSuccess(t.allEventsCleared || 'All data cleared');
    setShowSettings(false);
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
      className={`min-h-[100dvh] flex flex-col gradient-mesh ${theme !== 'light' ? theme : ''}`}
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

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onChangeTheme={handleThemeChange}
        language={language}
        onChangeLanguage={handleLanguageChange}
        onClearData={handleClearData}
        storageUsed={storageInfo.used}
        eventCount={storageInfo.eventCount}
      />

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
        onOpenSettings={() => setShowSettings(true)}
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

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-6 flex-1">
        {/* Empty State - Hero Landing */}
        {!showEventForm && displayEvents.length === 0 && viewMode === 'list' && (
          <div className="min-h-[60dvh] flex flex-col items-center justify-center text-center px-4">
            {/* Hero Icon */}
            <div className="relative mb-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[rgb(var(--primary))] to-[rgb(var(--primary)/0.7)] flex items-center justify-center shadow-xl">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-[rgb(var(--primary-foreground))]" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[rgb(var(--accent))] border-4 border-[rgb(var(--background))] flex items-center justify-center">
                <Plus className="w-4 h-4 text-[rgb(var(--foreground))]" />
              </div>
            </div>

            {/* Hero Text */}
            <h2 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--foreground))] mb-3">
              {t.noEventsYet}
            </h2>
            <p className="text-[rgb(var(--muted-foreground))] mb-8 max-w-md text-sm sm:text-base">
              {t.createFirstEvent}
            </p>

            {/* Primary Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowNewEventModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-xl hover:opacity-90 active:scale-[0.98] transition-all font-medium shadow-lg shadow-[rgb(var(--primary)/0.25)]"
              >
                <Plus className="w-5 h-5" />
                {t.newEvent}
              </button>
              <button
                onClick={handleImportClick}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[rgb(var(--card))] text-[rgb(var(--foreground))] rounded-xl hover:bg-[rgb(var(--accent))] active:scale-[0.98] transition-all font-medium border border-[rgb(var(--border))]"
              >
                <Download className="w-5 h-5" />
                {t.importICS}
              </button>
            </div>

            {/* Feature Pills */}
            <div className="mt-12 flex flex-wrap justify-center gap-2 max-w-lg">
              {[
                { icon: '🍎', label: 'Apple Calendar' },
                { icon: '📅', label: 'Google Calendar' },
                { icon: '📧', label: 'Outlook' },
                { icon: '🔄', label: t.recurringEvents?.split(' ')[0] || 'Recurring' },
              ].map((feature, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[rgb(var(--accent))] rounded-full text-xs font-medium text-[rgb(var(--muted-foreground))]"
                >
                  <span>{feature.icon}</span>
                  {feature.label}
                </span>
              ))}
            </div>

            {/* Service Info Card */}
            <div className="mt-8 p-4 bg-[rgb(var(--card))] rounded-2xl border border-[rgb(var(--border))] max-w-md w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgb(var(--accent))] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-[rgb(var(--primary))]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm text-[rgb(var(--foreground))]">
                    {t.universalCalendarSupport}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                    {t.serviceDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Has Events or Calendar View - Show Toolbar */}
        {(displayEvents.length > 0 || viewMode === 'calendar' || showEventForm) && (
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
                onClick={() => setShowNewEventModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t.newEvent}</span>
              </button>

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
        )}

        {/* Main Content Grid */}
        {(displayEvents.length > 0 || viewMode === 'calendar' || showEventForm) && (
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
            
            <div className={`${showEventForm ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12 xl:col-span-9'}`}>
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
              ) : null}
            </div>

            {!showEventForm && displayEvents.length > 0 && (
              <div className="hidden xl:block xl:col-span-3 space-y-4">
                <Card className="p-5">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[rgb(var(--primary))]">{displayEvents.length}</div>
                    <div className="text-sm text-[rgb(var(--muted-foreground))] mt-1">
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
        )}
      </main>

      <Footer />
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
