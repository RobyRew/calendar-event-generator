/**
 * Header Component
 */

import { Button } from '@/components/ui';
import { Calendar, Github } from 'lucide-react';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeSelector } from '@/components/ThemeSelector';
import { useI18n } from '@/context/I18nContext';
import { ThemeId } from '@/styles/themes';

interface HeaderProps {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  onOpenQuickActions?: () => void;
}

export function Header({ theme, onChangeTheme }: HeaderProps) {
  const { t } = useI18n();
  
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[rgb(var(--border))] bg-[rgb(var(--background)/0.8)] backdrop-blur-lg transition-theme">
      <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] shadow-lg">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm sm:text-base text-[rgb(var(--foreground))]">
              {t.appName}
            </h1>
            <p className="text-[10px] sm:text-xs text-[rgb(var(--muted-foreground))] hidden sm:block">
              {t.appDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSelector compact />
          
          <ThemeSelector 
            theme={theme} 
            onChangeTheme={onChangeTheme}
            compact
          />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open('https://github.com/RobyRew/calendar-event-generator', '_blank')}
            aria-label="View on GitHub"
            className="p-2 hidden sm:flex"
          >
            <Github className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
