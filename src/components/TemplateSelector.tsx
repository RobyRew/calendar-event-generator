/**
 * Template Selector Component
 * Allows users to select from built-in and custom templates
 * Can import/export templates as JSON
 */

import { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from '@/types';
import { useI18n } from '@/context/I18nContext';
import { Button, Card } from '@/components/ui';
import {
  FileText,
  Plus,
  Download,
  Upload,
  Trash2,
  Check,
  X,
} from 'lucide-react';

export interface EventTemplate {
  id: string;
  name: string;
  icon: string;
  duration: number; // minutes
  defaults: Partial<CalendarEvent>;
  isCustom?: boolean;
}

interface TemplateSelectorProps {
  onSelectTemplate: (template: EventTemplate) => void;
  onClose: () => void;
  onCreateBlank?: () => void;
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
      color: '#3b82f6', // blue
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
      color: '#22c55e', // green
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
      color: '#f59e0b', // amber
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
      color: '#ef4444', // red
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
      color: '#8b5cf6', // purple
    },
  },
  {
    id: 'birthday',
    name: 'Birthday',
    icon: '🎂',
    duration: 1440, // All day
    defaults: {
      summary: 'Birthday',
      categories: ['Personal', 'Birthday'],
      allDay: true,
      color: '#ec4899', // pink
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
      color: '#6366f1', // indigo
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
      color: '#14b8a6', // teal
    },
  },
  {
    id: 'deadline',
    name: 'Deadline',
    icon: '⚠️',
    duration: 30,
    defaults: {
      summary: 'Deadline',
      categories: ['Work', 'Deadline'],
      color: '#dc2626', // red-600
    },
  },
  {
    id: 'appointment',
    name: 'Appointment',
    icon: '📋',
    duration: 45,
    defaults: {
      summary: 'Appointment',
      categories: ['Appointment'],
      color: '#0891b2', // cyan
    },
  },
];

const TEMPLATES_STORAGE_KEY = 'calendar-custom-templates';

export function TemplateSelector({ onSelectTemplate, onClose, onCreateBlank, currentEvent }: TemplateSelectorProps) {
  const { t } = useI18n();
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
        setCustomTemplates(parsed.map((t: EventTemplate) => ({ ...t, isCustom: true })));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Save custom templates to localStorage
  const saveCustomTemplates = (templates: EventTemplate[]) => {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    setCustomTemplates(templates.map(t => ({ ...t, isCustom: true })));
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
  const handleDeleteTemplate = (templateId: string) => {
    const updated = customTemplates.filter(t => t.id !== templateId);
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
          const newTemplates = imported.map((t: EventTemplate) => ({
            ...t,
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
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Common emoji options for icons
  const emojiOptions = ['📌', '⭐', '💡', '🔔', '📝', '🎯', '💼', '🎓', '🏠', '💪', '🎮', '🎵', '🎨', '📚', '🌟'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t.templates}</h2>
          </div>
          <div className="flex items-center gap-2">
            {currentEvent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t.saveAsTemplate}
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
            <div className="flex items-end gap-3">
              {/* Icon Selector */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                  Icon
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-12 h-10 flex items-center justify-center text-xl bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg"
                  >
                    {newTemplateIcon}
                  </button>
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 z-10 hidden group-focus-within:block">
                    {emojiOptions.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewTemplateIcon(emoji)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Emoji dropdown on click */}
                <select
                  value={newTemplateIcon}
                  onChange={(e) => setNewTemplateIcon(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                >
                  {emojiOptions.map(emoji => (
                    <option key={emoji} value={emoji}>{emoji}</option>
                  ))}
                </select>
              </div>

              {/* Name Input */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                  {t.templateName}
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="My Template"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(false)}
                >
                  {t.cancel}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAsTemplate}
                  disabled={!newTemplateName.trim()}
                >
                  <Check className="w-4 h-4 mr-1" />
                  {t.save}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Built-in Templates */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">
              {t.builtInTemplates}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BUILT_IN_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
                >
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {template.duration >= 1440
                        ? 'All day'
                        : template.duration >= 60
                        ? `${Math.floor(template.duration / 60)}h ${template.duration % 60 > 0 ? `${template.duration % 60}m` : ''}`
                        : `${template.duration}m`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Templates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">
                {t.customTemplates}
              </h3>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportTemplates}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {t.import}
                </Button>
                {customTemplates.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportTemplates}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    {t.export}
                  </Button>
                )}
              </div>
            </div>

            {customTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>{t.noTemplates}</p>
                <p className="text-sm mt-1">
                  Create an event and save it as a template
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {customTemplates.map(template => (
                  <div
                    key={template.id}
                    className="relative group flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <button
                      onClick={() => onSelectTemplate(template)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <span className="text-2xl">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {template.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {template.duration >= 1440
                            ? 'All day'
                            : template.duration >= 60
                            ? `${Math.floor(template.duration / 60)}h`
                            : `${template.duration}m`}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 space-y-2">
          {onCreateBlank && (
            <Button variant="primary" onClick={onCreateBlank} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              {t.newEvent} (Blank)
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="w-full">
            {t.cancel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export { BUILT_IN_TEMPLATES };
