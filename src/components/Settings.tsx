/**
 * Settings Panel Component
 * Modern slide-out settings with intuitive UX
 */

import { useState, useEffect } from 'react';
import { useI18n } from '@/context';
import { ThemeId, THEMES } from '@/styles/themes';
import { 
  X, 
  Settings as SettingsIcon,
  Sun,
  Moon,
  Smartphone,
  Layers,
  Trash2,
  HardDrive,
  ChevronRight,
  Check,
  AlertTriangle
} from 'lucide-react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  language: string;
  onChangeLanguage: (lang: string) => void;
  onClearData: () => void;
  storageUsed: string;
  eventCount: number;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const getThemeIcon = (themeId: ThemeId) => {
  switch (themeId) {
    case 'light': return <Sun className="w-5 h-5" />;
    case 'dark': return <Moon className="w-5 h-5" />;
    case 'oled': return <Smartphone className="w-5 h-5" />;
    case 'neumorphic': return <Layers className="w-5 h-5" />;
    default: return <Sun className="w-5 h-5" />;
  }
};

export function Settings({
  isOpen,
  onClose,
  theme,
  onChangeTheme,
  language,
  onChangeLanguage,
  onClearData,
  storageUsed,
  eventCount,
}: SettingsProps) {
  const { t } = useI18n();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState<'main' | 'theme' | 'language'>('main');

  // Reset to main when opening
  useEffect(() => {
    if (isOpen) {
      setActiveSection('main');
      setShowClearConfirm(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSection !== 'main') {
          setActiveSection('main');
        } else {
          onClose();
        }
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, activeSection, onClose]);

  if (!isOpen) return null;

  const handleClearData = () => {
    onClearData();
    setShowClearConfirm(false);
  };

  const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
  const currentLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Settings Panel - Slide from right */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[rgb(var(--background))] z-50 shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-3">
            {activeSection !== 'main' && (
              <button
                onClick={() => setActiveSection('main')}
                className="p-2 -ml-2 hover:bg-[rgb(var(--accent))] rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180 text-[rgb(var(--muted-foreground))]" />
              </button>
            )}
            <SettingsIcon className="w-5 h-5 text-[rgb(var(--foreground))]" />
            <h2 className="text-lg font-semibold text-[rgb(var(--foreground))]">
              {activeSection === 'main' && (t.settings || 'Settings')}
              {activeSection === 'theme' && (t.theme || 'Theme')}
              {activeSection === 'language' && (t.language || 'Language')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgb(var(--accent))] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[rgb(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeSection === 'main' && (
            <div className="p-4 space-y-2">
              {/* Appearance Section */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted-foreground))] mb-3 px-2">
                  {t.appearance || 'Appearance'}
                </h3>
                
                {/* Theme Selector */}
                <button
                  onClick={() => setActiveSection('theme')}
                  className="w-full flex items-center justify-between p-4 bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))] rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[rgb(var(--accent))] flex items-center justify-center">
                      {getThemeIcon(theme)}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[rgb(var(--foreground))]">{t.theme || 'Theme'}</p>
                      <p className="text-sm text-[rgb(var(--muted-foreground))]">{currentTheme.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[rgb(var(--muted-foreground))] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Language Section */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted-foreground))] mb-3 px-2">
                  {t.language || 'Language'}
                </h3>
                
                <button
                  onClick={() => setActiveSection('language')}
                  className="w-full flex items-center justify-between p-4 bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))] rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[rgb(var(--accent))] flex items-center justify-center text-xl">
                      {currentLanguage.flag}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[rgb(var(--foreground))]">{t.language || 'Language'}</p>
                      <p className="text-sm text-[rgb(var(--muted-foreground))]">{currentLanguage.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[rgb(var(--muted-foreground))] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Data Section */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted-foreground))] mb-3 px-2">
                  {t.data || 'Data'}
                </h3>
                
                {/* Storage Info */}
                <div className="p-4 bg-[rgb(var(--card))] rounded-xl mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[rgb(var(--accent))] flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-[rgb(var(--foreground))]" />
                    </div>
                    <div>
                      <p className="font-medium text-[rgb(var(--foreground))]">{t.localStorage || 'Local Storage'}</p>
                      <p className="text-sm text-[rgb(var(--muted-foreground))]">
                        {eventCount} {eventCount === 1 ? (t.event || 'event') : (t.events || 'events')} • {storageUsed}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Clear Data */}
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full flex items-center justify-between p-4 bg-[rgb(var(--card))] hover:bg-red-500/10 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-red-500">{t.clearAllData || 'Clear All Data'}</p>
                        <p className="text-sm text-[rgb(var(--muted-foreground))]">{t.clearDataDescription || 'Delete all events and reset app'}</p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <p className="font-medium text-red-500">{t.confirmClearData || 'Are you sure?'}</p>
                    </div>
                    <p className="text-sm text-[rgb(var(--muted-foreground))] mb-4">
                      {t.clearDataWarning || 'This will permanently delete all your events. This action cannot be undone.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 px-4 py-2 bg-[rgb(var(--secondary))] text-[rgb(var(--foreground))] rounded-lg font-medium hover:opacity-90 transition-opacity"
                      >
                        {t.cancel || 'Cancel'}
                      </button>
                      <button
                        onClick={handleClearData}
                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                      >
                        {t.clearAll || 'Clear All'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Theme Selection */}
          {activeSection === 'theme' && (
            <div className="p-4 space-y-2">
              {THEMES.map((themeOption) => (
                <button
                  key={themeOption.id}
                  onClick={() => {
                    onChangeTheme(themeOption.id);
                    setActiveSection('main');
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                    theme === themeOption.id
                      ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                      : 'bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      theme === themeOption.id
                        ? 'bg-[rgb(var(--primary-foreground))]/20'
                        : 'bg-[rgb(var(--accent))]'
                    }`}>
                      {getThemeIcon(themeOption.id)}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{themeOption.name}</p>
                      <p className={`text-sm ${
                        theme === themeOption.id
                          ? 'text-[rgb(var(--primary-foreground))]/70'
                          : 'text-[rgb(var(--muted-foreground))]'
                      }`}>
                        {themeOption.description}
                      </p>
                    </div>
                  </div>
                  {theme === themeOption.id && (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Language Selection */}
          {activeSection === 'language' && (
            <div className="p-4 space-y-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onChangeLanguage(lang.code);
                    setActiveSection('main');
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                    language === lang.code
                      ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                      : 'bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                      language === lang.code
                        ? 'bg-[rgb(var(--primary-foreground))]/20'
                        : 'bg-[rgb(var(--accent))]'
                    }`}>
                      {lang.flag}
                    </div>
                    <p className="font-medium">{lang.name}</p>
                  </div>
                  {language === lang.code && (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
