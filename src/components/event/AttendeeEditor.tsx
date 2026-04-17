import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import type { EventAttendee, EventOrganizer } from '@/types'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'

interface AttendeeEditorProps {
  organizer: EventOrganizer | null
  attendees: EventAttendee[]
  onOrganizerChange: (organizer: EventOrganizer | null) => void
  onAttendeesChange: (attendees: EventAttendee[]) => void
}

export function AttendeeEditor({ organizer, attendees, onOrganizerChange, onAttendeesChange }: AttendeeEditorProps) {
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  const addAttendee = () => {
    onAttendeesChange([...attendees, {
      name: '',
      email: '',
      role: 'REQ-PARTICIPANT',
      status: 'NEEDS-ACTION',
      type: 'INDIVIDUAL',
      rsvp: true,
    }])
  }

  const removeAttendee = (idx: number) => {
    onAttendeesChange(attendees.filter((_, i) => i !== idx))
  }

  const updateAttendee = (idx: number, partial: Partial<EventAttendee>) => {
    onAttendeesChange(attendees.map((a, i) => i === idx ? { ...a, ...partial } : a))
  }

  return (
    <div className="space-y-4">
      {/* Organizer */}
      <div className="bg-surface-2 rounded-lg p-3 space-y-3">
        <h4 className="text-sm font-medium text-text">{t.organizer}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder={t.organizerName}
            value={organizer?.name ?? ''}
            onChange={(e) => onOrganizerChange({ ...organizer, name: e.target.value, email: organizer?.email ?? '' })}
          />
          <Input
            placeholder={t.organizerEmail}
            type="email"
            value={organizer?.email ?? ''}
            onChange={(e) => onOrganizerChange({ ...organizer, email: e.target.value, name: organizer?.name ?? '' })}
          />
        </div>
      </div>

      {/* Attendees */}
      {attendees.length === 0 && (
        <p className="text-sm text-text-3 py-2">{t.noAttendees}</p>
      )}

      {attendees.map((att, idx) => (
        <div key={idx} className="bg-surface-2 rounded-lg p-3 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">{t.attendees} {idx + 1}</span>
            <button
              onClick={() => removeAttendee(idx)}
              className="text-danger hover:bg-danger/10 p-1.5 rounded-md transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder={t.attendeeName}
              value={att.name}
              onChange={(e) => updateAttendee(idx, { name: e.target.value })}
            />
            <Input
              placeholder={t.attendeeEmail}
              type="email"
              value={att.email}
              onChange={(e) => updateAttendee(idx, { email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t.attendeeRole}
              options={[
                { value: 'CHAIR', label: t.roleChair },
                { value: 'REQ-PARTICIPANT', label: t.roleRequired },
                { value: 'OPT-PARTICIPANT', label: t.roleOptional },
                { value: 'NON-PARTICIPANT', label: t.roleNonParticipant },
              ]}
              value={att.role}
              onChange={(e) => updateAttendee(idx, { role: e.target.value as EventAttendee['role'] })}
            />
            <Select
              label={t.attendeeStatus}
              options={[
                { value: 'NEEDS-ACTION', label: t.statusNeedsAction },
                { value: 'ACCEPTED', label: t.statusAccepted },
                { value: 'DECLINED', label: t.statusDeclined },
                { value: 'TENTATIVE', label: t.statusTentative },
                { value: 'DELEGATED', label: t.statusDelegated },
              ]}
              value={att.status}
              onChange={(e) => updateAttendee(idx, { status: e.target.value as EventAttendee['status'] })}
            />
          </div>

          <Checkbox
            label={t.rsvp}
            checked={att.rsvp}
            onChange={(checked) => updateAttendee(idx, { rsvp: checked })}
          />
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={addAttendee}>
        <Plus size={16} /> {t.addAttendee}
      </Button>
    </div>
  )
}
