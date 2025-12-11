/**
 * Footer Component
 * App footer with credits and links
 */

import { Github, Heart, Calendar } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[rgb(var(--border))] bg-[rgb(var(--background))]">
      <div className="container mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="font-semibold text-[rgb(var(--foreground))]">
                {t.appName}
              </span>
            </div>
            <p className="text-sm text-[rgb(var(--muted-foreground))] text-center md:text-left">
              {t.appDescription}
            </p>
          </div>

          {/* Features */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-medium text-[rgb(var(--foreground))] mb-3">
              {t.features}
            </h3>
            <ul className="space-y-1.5 text-sm text-[rgb(var(--muted-foreground))] text-center md:text-left">
              <li>{t.importExportICS}</li>
              <li>{t.appleCalendarSupport}</li>
              <li>{t.googleCalendarSupport}</li>
              <li>{t.recurringEvents}</li>
            </ul>
          </div>

          {/* Links */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-medium text-[rgb(var(--foreground))] mb-3">
              {t.about}
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li>
                <a
                  href="https://github.com/RobyRew/calendar-event-generator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
                >
                  <Github className="w-4 h-4" />
                  {t.viewOnGitHub}
                </a>
              </li>
              <li>
                <span className="text-[rgb(var(--muted-foreground))]">
                  {t.version} 1.0.0
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[rgb(var(--border))]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
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
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              © {currentYear} {t.allRightsReserved}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
