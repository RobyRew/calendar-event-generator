/**
 * Header Component
 */

import { Button } from '@/components/ui';
import { Calendar, Settings } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface HeaderProps {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
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

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          aria-label={t.settings}
          className="p-2"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
