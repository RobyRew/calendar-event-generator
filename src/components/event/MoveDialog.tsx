import { useMemo, useState } from 'react'
import { Copy, FolderInput, Smartphone } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAccountStore, writableCalendars } from '@/stores/account-store'
import { useEventStore } from '@/stores/event-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { getTranslations, t as tr } from '@/i18n'
import { cn, eventKey } from '@/lib/utils'

interface MoveDialogProps {
  open: boolean
  onClose: () => void
  /** eventKey()s of the selected events; each takes the rest of its series along. */
  keys: string[]
  mode: 'move' | 'copy'
  onDone?: () => void
}

/** Pick where selected events go: this device or an account calendar the user can write to. */
export function MoveDialog({ open, onClose, keys, mode, onDone }: MoveDialogProps) {
  const language = useSettingsStore((s) => s.settings.language)
  const t = getTranslations(language)
  const calendars = useAccountStore((s) => s.calendars)
  const events = useEventStore((s) => s.events)
  const { moveEvents, copyEvents } = useEventStore()
  const showToast = useUIStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  const selected = useMemo(() => events.filter((e) => keys.includes(eventKey(e))), [events, keys])
  const sources = new Set(selected.map((e) => e.calendarId ?? ''))
  const series = new Set(selected.map((e) => `${e.calendarId ?? ''}/${e.uid}`)).size
  // A move into the calendar every selected event already lives in does nothing, so it is not offered.
  const only = sources.size === 1 ? [...sources][0]! : null
  const targets = [
    { id: '', name: t.onThisDevice, color: null as string | null },
    ...writableCalendars(calendars).map((c) => ({ id: c.id, name: c.name, color: c.color })),
  ].filter((c) => mode === 'copy' || c.id !== only)
  const [target, setTarget] = useState<string | null>(null)
  const chosen = target ?? targets.find((c) => c.id !== '')?.id ?? targets[0]?.id ?? ''

  const submit = async () => {
    setBusy(true)
    const dest = chosen || null
    const ok = mode === 'move' ? await moveEvents(keys, dest) : await copyEvents(keys, dest)
    setBusy(false)
    if (!ok) return // the store reports the error (see useCloudSync)
    showToast(tr(t, mode === 'move' ? 'movedN' : 'copiedN', { count: series }), 'success')
    onDone?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'move' ? t.moveEvents : t.copyEvents} fullScreenMobile={false}>
      <div className="p-4 space-y-3">
        <p className="text-sm text-text-3">{tr(t, 'selectedN', { count: series })}</p>
        <ul className="rounded-xl border border-border divide-y divide-border" role="radiogroup" aria-label={mode === 'move' ? t.moveTo : t.copyTo}>
          {targets.map((c) => (
            <li key={c.id || 'device'}>
              <button
                type="button"
                role="radio"
                aria-checked={chosen === c.id}
                onClick={() => setTarget(c.id)}
                className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left', chosen === c.id ? 'bg-accent/10 text-accent' : 'hover:bg-surface-2')}
              >
                {c.color
                  ? <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  : <Smartphone size={14} className="shrink-0" />}
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {targets.length === 0 && <p className="text-sm text-text-3">{t.noMoveTargets}</p>}
        <p className="text-xs text-text-3">{mode === 'move' ? t.moveHint : t.copyHint}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" disabled={busy || targets.length === 0 || selected.length === 0} onClick={submit}>
            {mode === 'move' ? <FolderInput size={16} /> : <Copy size={16} />} {mode === 'move' ? t.moveEvents : t.copyEvents}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
