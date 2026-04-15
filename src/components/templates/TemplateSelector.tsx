import { useState } from 'react'
import { FileStack, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useSettingsStore } from '@/stores/settings-store'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { getTranslations } from '@/i18n'
import { getAllTemplates, putTemplate, deleteTemplate as removeTemplate } from '@/lib/storage'
import { getLocalizedTemplate } from '@/lib/default-templates'
import { createDefaultEvent, generateUID } from '@/lib/utils'
import type { EventTemplate } from '@/types'
import { useLiveQuery } from 'dexie-react-hooks'

export function TemplateSelector() {
  const { settings } = useSettingsStore()
  const { addEvent } = useEventStore()
  const { openEditor, setActiveView } = useUIStore()
  const t = getTranslations(settings.language)
  const rawTemplates = useLiveQuery(() => getAllTemplates()) ?? []
  const templates = rawTemplates.map((tmpl) =>
    tmpl.isBuiltIn ? getLocalizedTemplate(tmpl, settings.language) : tmpl
  )
  const [saveName, setSaveName] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)

  const applyTemplate = async (template: EventTemplate) => {
    const localized = template.isBuiltIn ? getLocalizedTemplate(template, settings.language) : template
    const event = createDefaultEvent({
      ...localized.event,
      uid: generateUID(),
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      templateId: template.id,
    })
    await addEvent(event)
    setActiveView('events')
    openEditor(event.uid)
  }

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return
    const template: EventTemplate = {
      id: generateUID(),
      name: saveName.trim(),
      description: '',
      icon: '📅',
      color: settings.defaultCalendarColor,
      categories: [],
      isBuiltIn: false,
      event: {
        summary: saveName.trim(),
        color: settings.defaultCalendarColor,
        timezone: settings.defaultTimezone,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await putTemplate(template)
    setSaveName('')
    setShowSaveModal(false)
  }

  const handleDelete = async (id: string) => {
    if (settings.confirmBeforeDelete && !confirm(t.deleteTemplateConfirm)) return
    await removeTemplate(id)
  }

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">{t.templates}</h2>
        <Button variant="primary" size="sm" onClick={() => setShowSaveModal(true)}>
          <Plus size={16} /> {t.newTemplate}
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center animate-fade-in">
          <FileStack size={48} className="text-text-3 mb-4" />
          <h3 className="text-lg font-semibold text-text mb-1">{t.noTemplates}</h3>
          <p className="text-sm text-text-3 max-w-[260px]">{t.noTemplatesDesc}</p>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors group"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tmpl.event?.color || tmpl.color || '#007aff' }}
            />
            <button
              onClick={() => applyTemplate(tmpl)}
              className="flex-1 text-left"
            >
              <p className="text-sm font-medium text-text">{tmpl.name}</p>
              {tmpl.description && <p className="text-xs text-text-3">{tmpl.description}</p>}
            </button>
            <button
              onClick={() => handleDelete(tmpl.id)}
              className="p-1.5 rounded-md text-text-3 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title={t.newTemplate}
      >
        <div className="space-y-4 p-4">
          <Input
            label={t.templateName}
            placeholder={t.templateNamePlaceholder}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>{t.cancel}</Button>
            <Button variant="primary" onClick={handleSaveTemplate} disabled={!saveName.trim()}>
              {t.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
