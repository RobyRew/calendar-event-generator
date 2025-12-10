/**
 * Template Selector Component
 * Compact dropdown selector for templates
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
  ChevronDown,
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
  {
    id: 'deadline',
    name: 'Deadline',
    icon: '⚠️',
    duration: 30,
    defaults: {
      summary: 'Deadline',
      categories: ['Work', 'Deadline'],
      color: '#dc2626',
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
      color: '#0891b2',
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
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
  const handleDeleteTemplate = (templateId: string) => {
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

  // Handle template selection from dropdown
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  // Apply selected template
  const handleApplyTemplate = () => {
    if (!selectedTemplateId) return;
    
    const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];
    const template = allTemplates.find(tmpl => tmpl.id === selectedTemplateId);
    if (template) {
      onSelectTemplate(template);
    }
  };

  // Common emoji options for icons
  const emojiOptions = ['📌', '⭐', '💡', '🔔', '📝', '🎯', '💼', '🎓', '🏠', '💪', '🎮', '🎵', '🎨', '📚', '🌟'];

  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];
  const selectedTemplate = allTemplates.find(tmpl => tmpl.id === selectedTemplateId);

  const formatDuration = (minutes: number): string => {
    if (minutes >= 1440) return 'All day';
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t.newEvent}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Template Selector Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t.templates}
            </label>
            <div className="relative">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="">{t.selectTemplate || 'Select a template...'}</option>
                <optgroup label={t.builtInTemplates}>
                  {BUILT_IN_TEMPLATES.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.icon} {template.name} ({formatDuration(template.duration)})
                    </option>
                  ))}
                </optgroup>
                {customTemplates.length > 0 && (
                  <optgroup label={t.customTemplates}>
                    {customTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.icon} {template.name} ({formatDuration(template.duration)})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Selected Template Preview */}
          {selectedTemplate && (
            <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedTemplate.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {selectedTemplate.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Duration: {formatDuration(selectedTemplate.duration)}
                    {selectedTemplate.defaults.categories && selectedTemplate.defaults.categories.length > 0 && (
                      <span> • {selectedTemplate.defaults.categories.join(', ')}</span>
                    )}
                  </div>
                </div>
                {selectedTemplate.isCustom && (
                  <button
                    onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Template Actions */}
          <div className="flex items-center gap-2 text-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportTemplates}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Upload className="w-3.5 h-3.5" />
              {t.import}
            </button>
            {customTemplates.length > 0 && (
              <button
                onClick={handleExportTemplates}
                className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                {t.export}
              </button>
            )}
            {currentEvent && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 ml-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.saveAsTemplate}
              </button>
            )}
          </div>

          {/* Save as Template Dialog */}
          {showSaveDialog && (
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
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
                    {t.templateName}
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
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAsTemplate}
                  disabled={!newTemplateName.trim()}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaveDialog(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex gap-2">
          {selectedTemplateId ? (
            <Button variant="primary" onClick={handleApplyTemplate} className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              {t.createEvent || 'Create from Template'}
            </Button>
          ) : (
            <Button variant="primary" onClick={onCreateBlank} className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              {t.newEvent} ({t.blank || 'Blank'})
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export { BUILT_IN_TEMPLATES };
