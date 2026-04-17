import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { EventLocation } from '@/types'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'

interface LocationEditorProps {
  location: EventLocation | null
  onChange: (location: EventLocation | null) => void
}

export function LocationEditor({ location, onChange }: LocationEditorProps) {
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)
  const [showCoords, setShowCoords] = useState(!!location?.geo)

  const update = (partial: Partial<EventLocation>) => {
    onChange({ text: '', ...location, ...partial })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <MapPin size={18} className="text-text-3 mt-2.5 shrink-0" />
        <Textarea
          placeholder={t.locationPlaceholder}
          value={location?.text ?? ''}
          onChange={(e) => update({ text: e.target.value })}
          className="min-h-[60px]"
          rows={2}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowCoords(!showCoords)}
        className="text-sm text-accent flex items-center gap-1 hover:underline"
      >
        <Navigation size={14} />
        {t.coordinates}
      </button>

      {showCoords && (
        <div className="grid grid-cols-2 gap-3 animate-slide-down">
          <Input
            label={t.latitude}
            type="number"
            step="any"
            value={location?.geo?.latitude ?? ''}
            onChange={(e) => {
              const lat = parseFloat(e.target.value)
              if (!isNaN(lat)) {
                update({ geo: { latitude: lat, longitude: location?.geo?.longitude ?? 0 } })
              }
            }}
          />
          <Input
            label={t.longitude}
            type="number"
            step="any"
            value={location?.geo?.longitude ?? ''}
            onChange={(e) => {
              const lon = parseFloat(e.target.value)
              if (!isNaN(lon)) {
                update({ geo: { latitude: location?.geo?.latitude ?? 0, longitude: lon } })
              }
            }}
          />
        </div>
      )}

      <Input
        label={`${t.appleExtensions} – ${t.location}`}
        placeholder="Apple Maps address..."
        value={location?.appleAddress ?? location?.appleTitle ?? ''}
        onChange={(e) => update({ appleAddress: e.target.value, appleTitle: e.target.value })}
      />

      <Input
        label={`${t.appleExtensions} – ${t.appleRadius}`}
        type="number"
        step="any"
        placeholder="70"
        value={location?.appleRadius ?? ''}
        onChange={(e) => {
          const val = parseFloat(e.target.value)
          update({ appleRadius: isNaN(val) ? undefined : val })
        }}
      />

      <Input
        label={`${t.appleExtensions} – ${t.appleMapHandle}`}
        placeholder="X-APPLE-MAPKIT-HANDLE..."
        value={location?.appleMapItemHandle ?? ''}
        onChange={(e) => update({ appleMapItemHandle: e.target.value })}
      />
    </div>
  )
}
