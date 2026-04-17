import { useRef, useState, useCallback } from 'react'
import { Upload, Heart, Github } from 'lucide-react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { useIsMobile } from '@/hooks/use-media-query'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { getTranslations } from '@/i18n'
import { useImport, ImportModals } from '@/hooks/use-import'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile()
  const [isDragging, setIsDragging] = useState(false)
  const dragCountRef = useRef(0)
  const { settings } = useSettingsStore()
  const { showToast } = useUIStore()
  const t = getTranslations(settings.language)
  const importHook = useImport()

  const processFile = useCallback(async (file: File) => {
    try {
      const parsed = await importHook.parseFile(file)
      if (parsed.length === 0) {
        showToast(t.noEventsInFile, 'error')
        return
      }
      importHook.openImportChoice(parsed)
    } catch {
      showToast(t.importError, 'error')
    }
  }, [t, showToast, importHook])

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      await processFile(file)
    }
  }

  return (
    <div
      className="h-dvh flex flex-col bg-surface text-text overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Global drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-accent/10 border-2 border-dashed border-accent flex flex-col items-center justify-center gap-3 backdrop-blur-sm animate-fade-in pointer-events-none">
          <Upload size={48} className="text-accent" />
          <p className="text-lg font-semibold text-accent">{t.dragDropHint}</p>
          <p className="text-sm text-text-3">.ics, .json</p>
        </div>
      )}

      <Header />

      <div className="flex-1 flex overflow-hidden">
        {!isMobile && <Sidebar />}

        <main className="flex-1 overflow-y-auto">
          {children}

          {/* Credits */}
          <footer className="py-6 px-4 text-center text-xs text-text-3 border-t border-border/30 mt-8">
            <p className="flex items-center justify-center gap-1">
              Made with <Heart size={12} className="text-danger fill-danger" /> by{' '}
              <a
                href="https://github.com/RobyRew"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline font-medium"
              >
                RobyRew
              </a>
              <span className="text-border mx-1">·</span>
              <a
                href="https://github.com/RobyRew/calendar-event-generator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-3 hover:text-accent transition-colors"
                title="View on GitHub"
              >
                <Github size={13} />
              </a>
            </p>
          </footer>
        </main>
      </div>

      {isMobile && <MobileNav />}

      <ImportModals hook={importHook} onSuccess={(msg) => showToast(msg, 'success')} />
    </div>
  )
}
