import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, Link2, RefreshCw, Trash2, UserMinus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { getTranslations, t as tr, type Translations } from '@/i18n'
import { useAccountStore } from '@/stores/account-store'
import { api, type Member, type Permission, type Role, type Share } from '@/lib/cloud/api'
import { cn } from '@/lib/utils'

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  calendarId: string
  /** Share one event (its UID) instead of the whole calendar. */
  eventUid?: string | null
  title: string
}

const PERMISSIONS: Permission[] = ['busy', 'limited', 'full', 'edit']

export function permissionText(t: Translations, p: Permission): [string, string] {
  switch (p) {
    case 'busy': return [t.permBusy, t.permBusyDesc]
    case 'limited': return [t.permLimited, t.permLimitedDesc]
    case 'full': return [t.permFull, t.permFullDesc]
    case 'edit': return [t.permEdit, t.permEditDesc]
  }
}

const EXPIRY_DAYS = [0, 1, 7, 30, 365] as const

export function ShareDialog({ open, onClose, calendarId, eventUid = null, title }: ShareDialogProps) {
  const { settings } = useSettingsStore()
  const { showToast } = useUIStore()
  const t = getTranslations(settings.language)
  const [shares, setShares] = useState<Share[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [tab, setTab] = useState<'links' | 'people'>('links')
  const [permission, setPermission] = useState<Permission>('full')
  const [label, setLabel] = useState('')
  const [expiryDays, setExpiryDays] = useState<number>(0)
  const [busy, setBusy] = useState(false)

  const fmt = (ms: number) => new Intl.DateTimeFormat(settings.language, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)
  // A subscription calendar is read-only, so an editor invite to it would grant nothing.
  const readOnly = useAccountStore((st) => st.calendars.some((c) => c.id === calendarId && !!c.sourceUrl))
  const permissions = readOnly ? PERMISSIONS.filter((p) => p !== 'edit') : PERMISSIONS

  const reload = useCallback(async () => {
    const res = await api.shares(calendarId, eventUid)
    setShares(res.shares)
    setRole(res.role)
    if (res.role === 'owner') {
      const all = await api.members(calendarId)
      setMembers(eventUid ? all.filter((m) => m.eventUid === eventUid) : all)
    }
  }, [calendarId, eventUid])

  useEffect(() => {
    if (open) reload().catch(() => showToast(t.syncError, 'error'))
  }, [open, reload, showToast, t.syncError])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      await reload()
    } catch {
      showToast(t.syncError, 'error')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast(t.copied, 'success')
  }

  const create = () =>
    run(async () => {
      await api.createShare({
        calendarId,
        eventUid,
        permission,
        label: label.trim() || undefined,
        expiresAt: expiryDays ? Date.now() + expiryDays * 86_400_000 : null,
      })
      setLabel('')
    })

  const isOwner = role === 'owner'

  return (
    <Modal open={open} onClose={onClose} title={`${t.share}: ${title}`}>
      <div className="p-4 space-y-4">
        {isOwner && (
          <div className="flex gap-1 p-1 rounded-lg bg-surface-2 w-fit">
            {(['links', 'people'] as const).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn('px-3 py-1.5 rounded-md text-sm font-medium', tab === id ? 'bg-surface text-text shadow-sm' : 'text-text-2')}
              >
                {id === 'links' ? t.shareLinks : `${t.people} (${members.length})`}
              </button>
            ))}
          </div>
        )}

        {tab === 'links' && isOwner && (
          <section className="space-y-3 rounded-xl border border-border p-3">
            <div className="space-y-2" role="radiogroup" aria-label={t.access}>
              {permissions.map((p) => {
                const [name, desc] = permissionText(t, p)
                return (
                  <label key={p} className={cn('flex gap-3 items-start rounded-lg p-2 cursor-pointer', permission === p ? 'bg-accent/10' : 'hover:bg-surface-2')}>
                    <input type="radio" name="permission" value={p} checked={permission === p} onChange={() => setPermission(p)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-medium text-text">{name}</span>
                      <span className="block text-xs text-text-3">{desc}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label={t.linkName} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
              <Select
                label={t.expires}
                value={String(expiryDays)}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                options={EXPIRY_DAYS.map((d) => ({
                  value: String(d),
                  label: d === 0 ? t.expiresNever : fmt(Date.now() + d * 86_400_000),
                }))}
              />
            </div>
            <Button variant="primary" onClick={create} disabled={busy} className="w-full justify-center">
              <Link2 size={16} /> {t.createLink}
            </Button>
          </section>
        )}

        {tab === 'links' && (
          <section className="space-y-3">
            {shares.length === 0 && <p className="text-sm text-text-3">{t.noLinks}</p>}
            {shares.map((s) => {
              const [name] = permissionText(t, s.permission)
              const invite = s.permission === 'edit'
              return (
                <article key={s.id} className="rounded-xl border border-border p-3 space-y-2">
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-text">{s.personal ? t.yourSubscription : name}</div>
                      {s.label && <div className="text-xs text-text-2">{s.label}</div>}
                      <div className="text-xs text-text-3">
                        {s.lastAccessedAt ? tr(t, 'lastOpened', { date: fmt(s.lastAccessedAt), count: s.accessCount }) : t.neverOpened}
                        {s.expiresAt ? ` · ${tr(t, 'expiresOn', { date: fmt(s.expiresAt) })}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" title={t.rotate} aria-label={t.rotate} disabled={busy}
                        onClick={() => confirm(t.rotateConfirm) && run(() => api.rotateShare(s.id))}>
                        <RefreshCw size={16} />
                      </Button>
                      <Button size="icon" variant="ghost" title={t.revoke} aria-label={t.revoke} disabled={busy} className="!text-danger"
                        onClick={() => confirm(t.revokeConfirm) && run(() => api.revokeShare(s.id))}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </header>
                  <div className="flex gap-2">
                    <input readOnly value={s.links.page} className="rw-field h-9 flex-1 min-w-0 text-xs font-mono" aria-label={t.copyLink} onFocus={(e) => e.target.select()} />
                    <Button size="sm" onClick={() => copy(s.links.page)}><Copy size={14} /> {t.copyLink}</Button>
                  </div>
                  {!invite && (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <a className="rw-chip" href={s.links.webcal}>{t.addToApple}</a>
                      <a className="rw-chip" href={s.links.google} target="_blank" rel="noopener noreferrer">{t.addToGoogle}</a>
                      <a className="rw-chip" href={s.links.outlookCom} target="_blank" rel="noopener noreferrer">{t.addToOutlook}</a>
                      <a className="rw-chip" href={s.links.office365} target="_blank" rel="noopener noreferrer">{t.addToOffice365}</a>
                      <button className="rw-chip" onClick={() => copy(s.links.https)}>.ics URL</button>
                      <a className="rw-chip inline-flex items-center gap-1" href={s.links.page} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> QR</a>
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        )}

        {tab === 'people' && isOwner && (
          <section className="space-y-2">
            {members.length === 0 && <p className="text-sm text-text-3">{t.noPeople}</p>}
            {members.map((m) => {
              const who = m.name || m.email || m.userId
              return (
                <div key={`${m.userId}:${m.eventUid ?? ''}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate">{who}</div>
                    <div className="text-xs text-text-3 truncate">{m.email} · {m.role === 'editor' ? t.roleEditor : t.roleViewer}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="!text-danger" disabled={busy}
                    onClick={() => confirm(tr(t, 'removePersonConfirm', { name: who })) && run(() => api.removeMember(calendarId, m.userId, m.eventUid))}>
                    <UserMinus size={14} /> {t.removePerson}
                  </Button>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </Modal>
  )
}
