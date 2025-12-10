/**
 * Header Component
 */

import { Button } from '@/components/ui';
import { Calendar, Moon, Sun, Github, Plus } from 'lucide-react';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useI18n } from '@/context/I18nContext';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNewEvent: () => void;
}

export function Header({ darkMode, onToggleDarkMode, onNewEvent }: HeaderProps) {
  const { t } = useI18n();
  
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-slate-100">
              {t.appName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t.appDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={onNewEvent}>
            <Plus className="w-4 h-4" />
            {t.newEvent}
          </Button>

          <LanguageSelector compact />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? t.lightMode : t.darkMode}
          >
            {darkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open('https://github.com/RobyRew/calendar-event-generator', '_blank')}
            aria-label="View on GitHub"
          >
            <Github className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
