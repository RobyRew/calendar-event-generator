import { useState, useRef, useCallback, useEffect } from 'react'
import { parseISO, differenceInMinutes } from 'date-fns'
import { cn, downloadFile } from '@/lib/utils'
import type { CalendarEvent } from '@/types'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { formatDate, formatTime, formatDuration } from '@/lib/utils'
import { Clock, MapPin, Repeat, Bell, Users, FileDown, Pencil, Copy, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { generateSingleEventICS } from '@/lib/ics-generator'

interface EventCardProps {
  event: CalendarEvent
  compact?: boolean
  onClick?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

export function EventCard({ event, compact, onClick, onEdit, onDuplicate, onDelete }: EventCardProps) {
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)
  const duration = differenceInMinutes(parseISO(event.endDate), parseISO(event.startDate))
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  const handleQuickExport = () => {
    const ics = generateSingleEventICS(event, {
      includeAppleExtensions: settings.exportAppleExtensions,
      stripPersonalData: settings.stripPersonalDataOnExport,
    })
    downloadFile(ics, `${(event.summary || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`, 'text/calendar')
    setMenuPos(null)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTriggered.current = false
    const touch = e.touches[0]
    if (!touch) return
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setMenuPos({ x: touch.clientX, y: touch.clientY })
    }, 500)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    if (longPressTriggered.current) {
      e.preventDefault()
      longPressTriggered.current = false
      return
    }
    onClick?.()
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuPos) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [menuPos])

  // Adjust menu position to stay in viewport
  const getMenuStyle = (): React.CSSProperties => {
    if (!menuPos) return {}
    const menuWidth = 200
    const menuHeight = 200
    let x = menuPos.x
    let y = menuPos.y
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8
    if (x < 8) x = 8
    if (y < 8) y = 8
    return { position: 'fixed', left: x, top: y, zIndex: 60 }
  }

  const menuItems = [
    { icon: Pencil, label: t.editThisEvent, action: () => { setMenuPos(null); onEdit?.() } },
    { icon: Copy, label: t.duplicateEvent, action: () => { setMenuPos(null); onDuplicate?.() } },
    { icon: FileDown, label: t.exportAsICS, action: handleQuickExport },
    { icon: Trash2, label: t.deleteThisEvent, action: () => { setMenuPos(null); onDelete?.() }, danger: true },
  ]

  const contextMenu = menuPos && (
    <div
      ref={menuRef}
      style={getMenuStyle()}
      className="bg-surface border border-border rounded-xl shadow-xl py-1 min-w-[180px] animate-fade-in"
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left',
            item.danger
              ? 'text-danger hover:bg-danger/10'
              : 'text-text hover:bg-surface-2',
          )}
        >
          <item.icon size={16} />
          {item.label}
        </button>
      ))}
    </div>
  )

  if (compact) {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          className={cn(
            'w-full text-left px-3 py-2 rounded-lg transition-all duration-150 select-none',
            'hover:bg-surface-2 active:scale-[0.98]',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: event.color || '#007aff' }} />
            <span className="text-sm font-medium text-text truncate">{event.summary || t.newEvent}</span>
            <span className="text-xs text-text-3 ml-auto whitespace-nowrap">
              {event.allDay ? t.allDay : formatTime(event.startDate, settings.timeFormat)}
            </span>
          </div>
        </div>
        {contextMenu}
      </>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={cn(
          'w-full text-left rounded-xl transition-all duration-150 bg-surface border border-border/50',
          'hover:shadow-md active:scale-[0.98] p-4 select-none',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-1 h-full min-h-[40px] rounded-full shrink-0 self-stretch"
            style={{ backgroundColor: event.color || '#007aff' }}
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-text truncate">
              {event.summary || t.newEvent}
            </h3>

            <div className="flex items-center gap-3 mt-1 text-sm text-text-2">
              <span className="flex items-center gap-1">
                <Clock size={13} />
                {event.allDay
                  ? t.allDay
                  : `${formatTime(event.startDate, settings.timeFormat)} – ${formatTime(event.endDate, settings.timeFormat)}`}
              </span>
              <span className="text-text-3">{formatDuration(duration)}</span>
            </div>

            <p className="text-sm text-text-3 mt-0.5">
              {formatDate(event.startDate, settings.dateFormat)}
            </p>

            {event.location?.text && (
              <p className="text-sm text-text-3 mt-1 flex items-center gap-1 truncate">
                <MapPin size={13} /> {event.location.text}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {event.recurrenceRule && (
                <Badge color={event.color || '#007aff'} variant="outline">
                  <Repeat size={11} className="mr-1" />
                  {t[event.recurrenceRule.frequency.toLowerCase() as keyof typeof t] ?? event.recurrenceRule.frequency}
                </Badge>
              )}
              {event.alarms.length > 0 && (
                <Badge color={event.color || '#007aff'} variant="outline">
                  <Bell size={11} className="mr-1" /> {event.alarms.length}
                </Badge>
              )}
              {event.attendees.length > 0 && (
                <Badge color={event.color || '#007aff'} variant="outline">
                  <Users size={11} className="mr-1" /> {event.attendees.length}
                </Badge>
              )}
              {event.categories.map((cat) => (
                <Badge key={cat} color="#8e8e93" variant="outline">{cat}</Badge>
              ))}
              {event.status === 'TENTATIVE' && <Badge color="#ff9500">{t.tentative}</Badge>}
              {event.status === 'CANCELLED' && <Badge color="#ff3b30">{t.cancelled}</Badge>}
            </div>
          </div>
        </div>
      </div>
      {contextMenu}
    </>
  )
}
