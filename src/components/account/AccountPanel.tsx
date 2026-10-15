import { useState } from 'react'
import { Eye, EyeOff, LogIn, LogOut, Pencil, Plus, Share2, Trash2, Upload, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ShareDialog } from '@/components/share/ShareDialog'
import { useAccountStore, writableCalendars } from '@/stores/account-store'
import { useEventStore } from '@/stores/event-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { getTranslations, t as tr } from '@/i18n'
import { api } from '@/lib/cloud/api'
import { cn } from '@/lib/utils'

// The "Account" view (server build only): sign-in state, account calendars with
// show/hide, sharing, members, and copying this device's events into an account.

function VisibilityToggle({ id, label }: { id: string; label: string }) {
  const hidden = useAccountStore((s) => s.hidden.includes(id))
  const toggle = useAccountStore((s) => s.toggleHidden)
  return (
    <button onClick={() => toggle(id)} className="p-1.5 rounded-md text-text-2 hover:bg-surface-3" title={label} aria-label={label} aria-pressed={!hidden}>
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )
}

function Dot({ color }: { color: string }) {
  // SVG fill rather than an inline style attribute (the CSP has no 'unsafe-inline' for styles).
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  )
}

export function AccountPanel() {
  const { status, user, calendars, shared, refresh } = useAccountStore()
  const events = useEventStore((s) => s.events)
  const loadCloud = useEventStore((s) => s.loadCloud)
  const { settings } = useSettingsStore()
  const { showToast } = useUIStore()
  const t = getTranslations(settings.language)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(settings.defaultCalendarColor)
  const [shareTarget, setShareTarget] = useState<{ calendarId: string; eventUid: string | null; title: string } | null>(null)
  const [copyTarget, setCopyTarget] = useState('')
  const [busy, setBusy] = useState(false)

  const localEvents = events.filter((e) => !e.calendarId)
  const writable = writableCalendars(calendars)

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    try {
      await fn()
      await refresh()
      await loadCloud()
      if (success) showToast(success, 'success')
    } catch {
      showToast(t.syncError, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return null

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <section className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
        <h2 className="text-lg font-semibold">{t.account}</h2>
        {status === 'unavailable' && <p className="text-sm text-text-2">{t.accountsUnavailable}</p>}
        {status === 'signedOut' && (
          <>
            <p className="text-sm text-text-2">{t.signInHint}</p>
            <a href={api.signInUrl('/')} className="rw-btn rw-btn--primary h-10 inline-flex">
              <LogIn size={16} /> {t.signIn}
            </a>
          </>
        )}
        {status === 'signedIn' && user && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user.name || user.email}</div>
              {user.name && user.email && <div className="text-xs text-text-3 truncate">{user.email}</div>}
            </div>
            {/* A link, not a form: sign-out redirects to Logto's end-session page, and
                CSP form-action 'self' would block a form submission's cross-origin redirect. */}
            <a href="/api/auth/sign-out" className="rw-btn rw-btn--sm h-8 inline-flex"><LogOut size={14} /> {t.signOut}</a>
          </div>
        )}
      </section>

      {status === 'signedIn' && (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-3">{t.myCalendars}</h3>
            <ul className="rounded-xl border border-border divide-y divide-border">
              <li className="flex items-center gap-2 px-3 py-2.5">
                <span className="flex-1 text-sm">{t.onThisDevice} <span className="text-text-3">· {localEvents.length}</span></span>
                <VisibilityToggle id="local" label={t.onThisDevice} />
              </li>
              {calendars.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                  <Dot color={c.color} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{c.name}</div>
                    <div className="text-xs text-text-3 truncate">
                      {c.role === 'owner' ? t.roleOwner : `${c.role === 'editor' ? t.roleEditor : t.roleViewer} · ${c.ownerName ?? ''}`}
                    </div>
                  </div>
                  <VisibilityToggle id={c.id} label={c.name} />
                  <button className="p-1.5 rounded-md text-text-2 hover:bg-surface-3" title={t.share} aria-label={t.share}
                    onClick={() => setShareTarget({ calendarId: c.id, eventUid: null, title: c.name })}>
                    <Share2 size={16} />
                  </button>
                  {c.role === 'owner' ? (
                    <>
                      <button className="p-1.5 rounded-md text-text-2 hover:bg-surface-3" title={t.renameCalendar} aria-label={t.renameCalendar} disabled={busy}
                        onClick={() => {
                          const name = prompt(t.calendarName, c.name)?.trim()
                          if (name && name !== c.name) run(() => api.updateCalendar(c.id, { name }))
                        }}>
                        <Pencil size={16} />
                      </button>
                      <button className="p-1.5 rounded-md text-danger hover:bg-danger/10" title={t.deleteCalendar} aria-label={t.deleteCalendar} disabled={busy}
                        onClick={() => confirm(t.deleteCalendarConfirm) && run(() => api.deleteCalendar(c.id))}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <button className="p-1.5 rounded-md text-danger hover:bg-danger/10" title={t.leave} aria-label={t.leave} disabled={busy}
                      onClick={() => user && run(() => api.removeMember(c.id, user.id))}>
                      <UserMinus size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <form
              className="rounded-xl border border-border p-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                const name = newName.trim()
                if (!name) return
                run(async () => {
                  await api.createCalendar({ name, color: newColor, timezone: settings.defaultTimezone })
                  setNewName('')
                })
              }}
            >
              <Input label={t.newCalendar} placeholder={t.calendarName} value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} />
              <ColorPicker value={newColor} onChange={setNewColor} />
              <Button type="submit" variant="primary" disabled={busy || !newName.trim()}><Plus size={16} /> {t.create}</Button>
            </form>
          </section>

          {writable.length > 0 && localEvents.length > 0 && (
            <section className="rounded-xl border border-border p-3 space-y-3">
              <div>
                <h3 className="text-sm font-semibold">{t.copyToAccount}</h3>
                <p className="text-xs text-text-3">{t.copyToAccountDesc}</p>
              </div>
              <Select
                label={t.saveTo}
                value={copyTarget || writable[0]!.id}
                onChange={(e) => setCopyTarget(e.target.value)}
                options={writable.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Button disabled={busy} onClick={() => {
                const target = copyTarget || writable[0]!.id
                run(() => api.importEvents(target, localEvents), tr(t, 'copiedToAccount', { count: localEvents.length }))
              }}>
                <Upload size={16} /> {t.copyToAccount} ({localEvents.length})
              </Button>
            </section>
          )}

          {shared.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-3">{t.sharedWithMe}</h3>
                <VisibilityToggle id="shared" label={t.sharedWithMe} />
              </div>
              <ul className="rounded-xl border border-border divide-y divide-border">
                {shared.map((s) => {
                  const master = s.events.find((e) => !e.recurrenceId) ?? s.events[0]
                  const title = master?.summary || s.uid
                  return (
                    <li key={`${s.calendarId}/${s.uid}`} className={cn('flex items-center gap-2 px-3 py-2.5')}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{title}</div>
                        <div className="text-xs text-text-3 truncate">{s.calendarName} · {s.role === 'editor' ? t.roleEditor : t.roleViewer}</div>
                      </div>
                      <button className="p-1.5 rounded-md text-text-2 hover:bg-surface-3" title={t.share} aria-label={t.share}
                        onClick={() => setShareTarget({ calendarId: s.calendarId, eventUid: s.uid, title })}>
                        <Share2 size={16} />
                      </button>
                      <button className="p-1.5 rounded-md text-danger hover:bg-danger/10" title={t.leave} aria-label={t.leave} disabled={busy}
                        onClick={() => user && run(() => api.removeMember(s.calendarId, user.id, s.uid))}>
                        <UserMinus size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {shareTarget && (
        <ShareDialog
          open
          onClose={() => setShareTarget(null)}
          calendarId={shareTarget.calendarId}
          eventUid={shareTarget.eventUid}
          title={shareTarget.title}
        />
      )}
    </div>
  )
}
