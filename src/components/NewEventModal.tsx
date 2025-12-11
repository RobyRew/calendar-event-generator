/**
 * New Event Modal Component
 * Shows options for creating a new event: blank, from template, or import
 */

import { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from '@/types';
import { useI18n } from '@/context/I18nContext';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Check,
  X,
  LayoutTemplate,
  Calendar,
  ChevronRight,
} from 'lucide-react';

export interface EventTemplate {
  id: string;
  name: string;
  icon: string;
  duration: number; // minutes
  defaults: Partial<CalendarEvent>;
  isCustom?: boolean;
}

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
  onSelectTemplate: (template: EventTemplate) => void;
  onImportClick: () => void;
  currentEvent?: CalendarEvent | null;
}

// Built-in templates
const BUILT_IN_TEMPLATES: EventTemplate[] = [
  {
    id: 'meeting',
    name: 'Meeting',
    icon: '📅',
    duration: 60,
    defaults: {
      summary: 'Meeting',
      categories: ['Meeting', 'Work'],
      color: '#3b82f6',
    },
  },
  {
    id: 'call',
    name: 'Phone Call',
    icon: '📞',
    duration: 30,
    defaults: {
      summary: 'Phone Call',
      categories: ['Call'],
      color: '#22c55e',
    },
  },
  {
    id: 'lunch',
    name: 'Lunch',
    icon: '🍽️',
    duration: 60,
    defaults: {
      summary: 'Lunch',
      categories: ['Personal'],
      color: '#f59e0b',
    },
  },
  {
    id: 'workout',
    name: 'Workout',
    icon: '🏋️',
    duration: 60,
    defaults: {
      summary: 'Workout',
      categories: ['Health', 'Personal'],
      color: '#ef4444',
    },
  },
  {
    id: 'focus',
    name: 'Focus Time',
    icon: '🎯',
    duration: 120,
    defaults: {
      summary: 'Focus Time',
      description: 'Deep work - no interruptions',
      categories: ['Work', 'Focus'],
      color: '#8b5cf6',
    },
  },
  {
    id: 'birthday',
    name: 'Birthday',
    icon: '🎂',
    duration: 1440,
    defaults: {
      summary: 'Birthday',
      categories: ['Personal', 'Birthday'],
      allDay: true,
      color: '#ec4899',
    },
  },
  {
    id: 'reminder',
    name: 'Reminder',
    icon: '⏰',
    duration: 15,
    defaults: {
      summary: 'Reminder',
      categories: ['Reminder'],
      color: '#6366f1',
    },
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: '✈️',
    duration: 180,
    defaults: {
      summary: 'Travel',
      categories: ['Travel'],
      color: '#14b8a6',
    },
  },
];

const TEMPLATES_STORAGE_KEY = 'calendar-custom-templates';

export function NewEventModal({ 
  isOpen, 
  onClose, 
  onCreateBlank, 
  onSelectTemplate, 
  onImportClick,
  currentEvent 
}: NewEventModalProps) {
  const { t } = useI18n();
  const [view, setView] = useState<'options' | 'templates'>('options');
  const [customTemplates, setCustomTemplates] = useState<EventTemplate[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateIcon, setNewTemplateIcon] = useState('📌');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom templates from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCustomTemplates(parsed.map((tmpl: EventTemplate) => ({ ...tmpl, isCustom: true })));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Reset view when modal opens
  useEffect(() => {
    if (isOpen) {
      setView('options');
    }
  }, [isOpen]);

  // Save custom templates to localStorage
  const saveCustomTemplates = (templates: EventTemplate[]) => {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    setCustomTemplates(templates.map(tmpl => ({ ...tmpl, isCustom: true })));
  };

  // Save current event as template
  const handleSaveAsTemplate = () => {
    if (!currentEvent || !newTemplateName.trim()) return;

    const newTemplate: EventTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      icon: newTemplateIcon,
      duration: Math.round(
        (currentEvent.endDate.getTime() - currentEvent.startDate.getTime()) / 60000
      ),
      defaults: {
        summary: currentEvent.summary,
        description: currentEvent.description,
        location: currentEvent.location,
        categories: currentEvent.categories,
        color: currentEvent.color,
        url: currentEvent.url,
        allDay: currentEvent.allDay,
      },
      isCustom: true,
    };

    saveCustomTemplates([...customTemplates, newTemplate]);
    setShowSaveDialog(false);
    setNewTemplateName('');
  };

  // Delete custom template
  const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter(tmpl => tmpl.id !== templateId);
    saveCustomTemplates(updated);
  };

  // Export templates as JSON
  const handleExportTemplates = () => {
    const data = JSON.stringify(customTemplates, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calendar-templates.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import templates from JSON
  const handleImportTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const newTemplates = imported.map((tmpl: EventTemplate) => ({
            ...tmpl,
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            isCustom: true,
          }));
          saveCustomTemplates([...customTemplates, ...newTemplates]);
        }
      } catch {
        alert('Invalid template file');
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes >= 1440) return 'All day';
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
  };

  // Common emoji options for icons
  const emojiOptions = ['📌', '⭐', '💡', '🔔', '📝', '🎯', '💼', '🎓', '🏠', '💪', '🎮', '🎵', '🎨', '📚', '🌟'];

  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-lg bg-[rgb(var(--card))] rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden animate-slide-up sm:animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            {view === 'templates' && (
              <button
                onClick={() => setView('options')}
                className="p-1 hover:bg-[rgb(var(--accent))] rounded mr-1"
              >
                <ChevronRight className="w-5 h-5 text-[rgb(var(--muted-foreground))] rotate-180" />
              </button>
            )}
            <Calendar className="w-5 h-5 text-[rgb(var(--primary))]" />
            <h2 className="text-lg font-semibold text-[rgb(var(--foreground))]">
              {view === 'options' ? t.newEvent : t.templates}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgb(var(--accent))] rounded-lg"
          >
            <X className="w-5 h-5 text-[rgb(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportTemplates}
          className="hidden"
        />

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          {view === 'options' ? (
            /* Main Options View */
            <div className="space-y-3">
              {/* Blank Event - Primary Option */}
              <button
                onClick={onCreateBlank}
                className="w-full flex items-center gap-4 p-4 bg-[rgb(var(--primary)/0.1)] hover:bg-[rgb(var(--primary)/0.15)] rounded-xl border-2 border-[rgb(var(--primary)/0.3)] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-[rgb(var(--primary))] flex items-center justify-center flex-shrink-0">
                  <Plus className="w-6 h-6 text-[rgb(var(--primary-foreground))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[rgb(var(--foreground))]">
                    {t.newBlankEvent || 'Blank Event'}
                  </div>
                  <div className="text-sm text-[rgb(var(--muted-foreground))]">
                    Start fresh with an empty event
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[rgb(var(--muted-foreground))] flex-shrink-0" />
              </button>

              {/* From Template */}
              <button
                onClick={() => setView('templates')}
                className="w-full flex items-center gap-4 p-4 bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))] rounded-xl border border-[rgb(var(--border))] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-[rgb(var(--accent))] flex items-center justify-center flex-shrink-0">
                  <LayoutTemplate className="w-6 h-6 text-[rgb(var(--foreground))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[rgb(var(--foreground))]">
                    {t.newFromTemplate || 'From Template'}
                  </div>
                  <div className="text-sm text-[rgb(var(--muted-foreground))]">
                    Choose from {allTemplates.length} templates
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[rgb(var(--muted-foreground))] flex-shrink-0" />
              </button>

              {/* Import ICS */}
              <button
                onClick={() => {
                  onImportClick();
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))] rounded-xl border border-[rgb(var(--border))] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-[rgb(var(--accent))] flex items-center justify-center flex-shrink-0">
                  <Upload className="w-6 h-6 text-[rgb(var(--foreground))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[rgb(var(--foreground))]">
                    {t.importFromFile || 'Import ICS File'}
                  </div>
                  <div className="text-sm text-[rgb(var(--muted-foreground))]">
                    Import events from .ics files
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[rgb(var(--muted-foreground))] flex-shrink-0" />
              </button>
            </div>
          ) : (
            /* Templates View */
            <div className="space-y-4">
              {/* Template Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template)}
                    className="relative flex flex-col items-center gap-2 p-3 bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))] rounded-xl border border-[rgb(var(--border))] transition-all hover:scale-[1.02] hover:shadow-md text-center group"
                  >
                    <span className="text-3xl">{template.icon}</span>
                    <div className="w-full">
                      <div className="font-medium text-sm text-[rgb(var(--foreground))] truncate">
                        {template.name}
                      </div>
                      <div className="text-xs text-[rgb(var(--muted-foreground))]">
                        {formatDuration(template.duration)}
                      </div>
                    </div>
                    {template.isCustom && (
                      <button
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                  </button>
                ))}
              </div>

              {/* Template Management */}
              <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Import Templates
                  </button>
                  {customTemplates.length > 0 && (
                    <button
                      onClick={handleExportTemplates}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export Templates
                    </button>
                  )}
                  {currentEvent && (
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors ml-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Create Template
                    </button>
                  )}
                </div>

                {/* Save as Template Dialog */}
                {showSaveDialog && (
                  <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                    <div className="flex items-end gap-2">
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                          Icon
                        </label>
                        <select
                          value={newTemplateIcon}
                          onChange={(e) => setNewTemplateIcon(e.target.value)}
                          className="w-14 h-9 text-center bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-lg"
                        >
                          {emojiOptions.map(emoji => (
                            <option key={emoji} value={emoji}>{emoji}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                          Template Name
                        </label>
                        <input
                          type="text"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          placeholder="My Template"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={handleSaveAsTemplate}
                        disabled={!newTemplateName.trim()}
                        className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowSaveDialog(false)}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { BUILT_IN_TEMPLATES };
