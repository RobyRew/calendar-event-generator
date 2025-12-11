/**
 * Footer Component
 * Minimal on mobile, expanded on desktop
 */

import { Github, Heart } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[rgb(var(--border))] bg-[rgb(var(--background))] mt-8">
      {/* Mobile Footer - Compact */}
      <div className="sm:hidden py-4 px-4">
        <div className="flex items-center justify-between text-xs text-[rgb(var(--muted-foreground))]">
          <p className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            <a
              href="https://github.com/RobyRew"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-[rgb(var(--foreground))]"
            >
              RobyRew
            </a>
          </p>
          <a
            href="https://github.com/RobyRew/calendar-event-generator"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[rgb(var(--foreground))]"
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
        </div>
      </div>

      {/* Desktop Footer - Full */}
      <div className="hidden sm:block">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left - Brand & Description */}
            <div className="flex items-center gap-3">
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                {t.appName}
              </p>
              <span className="text-[rgb(var(--border))]">•</span>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                {t.version} 1.0.0
              </p>
            </div>

            {/* Center - Credits */}
            <p className="text-sm text-[rgb(var(--muted-foreground))] flex items-center gap-1">
              {t.madeWith} <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> {t.by}{' '}
              <a
                href="https://github.com/RobyRew"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[rgb(var(--foreground))] hover:text-[rgb(var(--primary))] transition-colors"
              >
                RobyRew
              </a>
            </p>

            {/* Right - Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/RobyRew/calendar-event-generator"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
              >
                <Github className="w-4 h-4" />
                {t.viewOnGitHub}
              </a>
              <span className="text-xs text-[rgb(var(--muted-foreground))]">
                © {currentYear}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
