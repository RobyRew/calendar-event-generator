/**
 * Command Palette Component (Spotlight-style)
 * Quick actions and search with keyboard shortcuts
 * Triggered by Cmd/Ctrl + K
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CalendarEvent } from '@/types';
import { useI18n } from '@/context/I18nContext';
import { 
  Search, 
  Plus, 
  Calendar, 
  Download, 
  Upload, 
  Trash2, 
  Sun,
  Moon,
  Smartphone,
  Layers,
  FileText,
  Tag,
  Command
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: 'action' | 'event' | 'navigation' | 'settings';
}

import { ThemeId, THEMES } from '@/styles/themes';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onNewEvent: () => void;
  onSelectEvent: (eventId: string) => void;
  onExportAll: () => void;
  onImportClick: () => void;
  onChangeTheme: (theme: ThemeId) => void;
  theme: ThemeId;
  onClearAll: () => void;
}

// Helper to get theme icons
const getThemeIcon = (themeId: ThemeId): React.ReactNode => {
  switch (themeId) {
    case 'light': return <Sun className="w-4 h-4" />;
    case 'dark': return <Moon className="w-4 h-4" />;
    case 'oled': return <Smartphone className="w-4 h-4" />;
    case 'neumorphic': return <Layers className="w-4 h-4" />;
  }
};

// Predefined event templates
export const EVENT_TEMPLATES = [
  {
    id: 'meeting',
    name: '📅 Meeting',
    duration: 60, // minutes
    defaults: {
      summary: 'Meeting',
      categories: ['Meeting', 'Work'],
    }
  },
  {
    id: 'call',
    name: '📞 Phone Call',
    duration: 30,
    defaults: {
      summary: 'Phone Call',
      categories: ['Call'],
    }
  },
  {
    id: 'lunch',
    name: '🍽️ Lunch',
    duration: 60,
    defaults: {
      summary: 'Lunch',
      categories: ['Personal'],
    }
  },
  {
    id: 'workout',
    name: '🏋️ Workout',
    duration: 60,
    defaults: {
      summary: 'Workout',
      categories: ['Health', 'Personal'],
    }
  },
  {
    id: 'focus',
    name: '🎯 Focus Time',
    duration: 120,
    defaults: {
      summary: 'Focus Time',
      description: 'Deep work - no interruptions',
      categories: ['Work', 'Focus'],
    }
  },
  {
    id: 'birthday',
    name: '🎂 Birthday',
    duration: 1440, // All day
    defaults: {
      summary: 'Birthday',
      categories: ['Personal', 'Birthday'],
      allDay: true,
    }
  },
  {
    id: 'reminder',
    name: '⏰ Reminder',
    duration: 15,
    defaults: {
      summary: 'Reminder',
      categories: ['Reminder'],
    }
  },
  {
    id: 'travel',
    name: '✈️ Travel',
    duration: 480,
    defaults: {
      summary: 'Travel',
      categories: ['Travel'],
    }
  },
];

export function CommandPalette({
  isOpen,
  onClose,
  events,
  onNewEvent,
  onSelectEvent,
  onExportAll,
  onImportClick,
  onChangeTheme,
  theme,
  onClearAll,
}: CommandPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Build command list
  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [
      // Actions
      {
        id: 'new-event',
        title: 'New Event',
        subtitle: 'Create a new calendar event',
        icon: <Plus className="w-4 h-4" />,
        action: () => { onNewEvent(); onClose(); },
        keywords: ['create', 'add', 'new', 'event'],
        category: 'action',
      },
      {
        id: 'import',
        title: 'Import ICS File',
        subtitle: 'Import events from .ics file',
        icon: <Upload className="w-4 h-4" />,
        action: () => { onImportClick(); onClose(); },
        keywords: ['import', 'upload', 'ics', 'file'],
        category: 'action',
      },
      {
        id: 'export',
        title: 'Export All Events',
        subtitle: `Export ${events.length} event(s) to .ics`,
        icon: <Download className="w-4 h-4" />,
        action: () => { onExportAll(); onClose(); },
        keywords: ['export', 'download', 'ics', 'save'],
        category: 'action',
      },
      {
        id: 'clear-all',
        title: 'Clear All Events',
        subtitle: 'Remove all events from workspace',
        icon: <Trash2 className="w-4 h-4 text-red-500" />,
        action: () => { 
          if (confirm('Are you sure you want to delete all events?')) {
            onClearAll(); 
            onClose(); 
          }
        },
        keywords: ['clear', 'delete', 'remove', 'all'],
        category: 'action',
      },
      
      // Templates - Single command that opens the template modal
      {
        id: 'new-from-template',
        title: t.newFromTemplate,
        subtitle: t.createEvent,
        icon: <FileText className="w-4 h-4" />,
        action: () => { onNewEvent(); onClose(); },
        keywords: ['template', 'quick', 'preset', 'meeting', 'call', 'lunch', 'workout'],
        category: 'action',
      },
      
      // Theme settings - Add all themes as options
      ...THEMES.map(themeOption => ({
        id: `theme-${themeOption.id}`,
        title: `${t.switchToTheme} ${themeOption.name}`,
        subtitle: theme === themeOption.id ? `✓ ${t.currentTheme}` : themeOption.description,
        icon: getThemeIcon(themeOption.id),
        action: () => { onChangeTheme(themeOption.id); onClose(); },
        keywords: ['theme', 'mode', themeOption.id, themeOption.name.toLowerCase()],
        category: 'settings' as const,
      })),
      
      // Events (searchable)
      ...events.map(event => ({
        id: `event-${event.uid}`,
        title: event.summary,
        subtitle: event.startDate.toLocaleDateString(),
        icon: <Calendar className="w-4 h-4" />,
        action: () => { onSelectEvent(event.uid); onClose(); },
        keywords: [
          event.summary.toLowerCase(),
          event.description?.toLowerCase() || '',
          ...(event.categories || []).map(c => c.toLowerCase()),
          event.location?.text?.toLowerCase() || '',
        ],
        category: 'event' as const,
      })),
    ];
    
    return items;
  }, [events, theme, t, onNewEvent, onSelectEvent, onExportAll, onImportClick, onChangeTheme, onClearAll, onClose]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show actions first, then recent events
      return commands
        .filter(c => c.category === 'action' || c.category === 'settings')
        .slice(0, 15);
    }
    
    const lowerQuery = query.toLowerCase();
    return commands
      .filter(cmd => {
        const titleMatch = cmd.title.toLowerCase().includes(lowerQuery);
        const subtitleMatch = cmd.subtitle?.toLowerCase().includes(lowerQuery);
        const keywordMatch = cmd.keywords?.some(k => k.includes(lowerQuery));
        return titleMatch || subtitleMatch || keywordMatch;
      })
      .slice(0, 20);
  }, [commands, query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Command Palette */}
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search events, actions, or type a command..."
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 outline-none text-lg"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 rounded">
            <span>esc</span>
          </kbd>
        </div>
        
        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-400">
              No results found for "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  transition-colors
                  ${index === selectedIndex 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }
                `}
              >
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                  ${index === selectedIndex 
                    ? 'bg-white/20' 
                    : 'bg-gray-100 dark:bg-slate-700'
                  }
                `}>
                  {cmd.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{cmd.title}</div>
                  {cmd.subtitle && (
                    <div className={`text-sm truncate ${
                      index === selectedIndex ? 'text-white/70' : 'text-gray-500 dark:text-slate-400'
                    }`}>
                      {cmd.subtitle}
                    </div>
                  )}
                </div>
                {cmd.category === 'event' && (
                  <Tag className="w-4 h-4 opacity-50" />
                )}
              </button>
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">↵</kbd>
              select
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>K to open</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for keyboard shortcut
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
