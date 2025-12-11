/**
 * Event Form Component - Mobile First with Accordion Sections
 * Comprehensive form for creating/editing calendar events
 */

import { useState, useCallback } from 'react';
import { CalendarEvent, RecurrenceFrequency, WeekDay, EventClass, EventStatus, TimeTransparency, Alarm, COMMON_TIMEZONES } from '@/types';
import { Button, Input, Textarea, Select, Checkbox, Card, Badge } from '@/components/ui';
import { Calendar, Clock, MapPin, Users, Bell, Repeat, Globe, Settings, Plus, Trash2, Apple, ChevronDown } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface EventFormProps {
  event: CalendarEvent;
  onChange: (event: CalendarEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

const TIMEZONE_OPTIONS = Object.keys(COMMON_TIMEZONES).map(tz => ({
  value: tz,
  label: tz.replace(/_/g, ' '),
}));

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const WEEKDAYS: { value: WeekDay; label: string }[] = [
  { value: 'SU', label: 'Sun' },
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
];

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'TENTATIVE', label: 'Tentative' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const CLASS_OPTIONS: { value: EventClass; label: string }[] = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'CONFIDENTIAL', label: 'Confidential' },
];

const TRANSPARENCY_OPTIONS: { value: TimeTransparency; label: string }[] = [
  { value: 'OPAQUE', label: 'Busy' },
  { value: 'TRANSPARENT', label: 'Free' },
];

const ALARM_PRESETS = [
  { label: 'At time of event', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
  { label: '1 week before', value: 10080 },
];

// Accordion Section Component
interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string | number;
}

function AccordionSection({ title, icon, isOpen, onToggle, children, badge }: AccordionSectionProps) {
  return (
    <div className="border border-[rgb(var(--border))] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          isOpen 
            ? 'bg-[rgb(var(--accent))]' 
            : 'bg-[rgb(var(--card))] hover:bg-[rgb(var(--accent))]'
        }`}
      >
        <span className={`transition-colors ${isOpen ? 'text-[rgb(var(--primary))]' : 'text-[rgb(var(--muted-foreground))]'}`}>
          {icon}
        </span>
        <span className={`flex-1 font-medium text-sm ${isOpen ? 'text-[rgb(var(--foreground))]' : 'text-[rgb(var(--muted-foreground))]'}`}>
          {title}
        </span>
        {badge !== undefined && (
          <Badge variant="primary">{badge}</Badge>
        )}
        <ChevronDown 
          className={`w-4 h-4 text-[rgb(var(--muted-foreground))] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      {isOpen && (
        <div className="px-4 py-4 bg-[rgb(var(--card))] border-t border-[rgb(var(--border))] animate-accordion-down">
          {children}
        </div>
      )}
    </div>
  );
}

export function EventForm({ event, onChange, onSave, onCancel }: EventFormProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['basic', 'datetime']));
  const [categoriesInput, setCategoriesInput] = useState(event.categories?.join(', ') || '');

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Format dates for input fields (using local time, not UTC)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDateOnly = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Safe date parsing that won't crash on invalid input
  const parseDateSafe = (value: string, fallback: Date): Date => {
    if (!value || value.trim() === '') return fallback;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? fallback : parsed;
  };

  const handleChange = useCallback(<K extends keyof CalendarEvent>(field: K, value: CalendarEvent[K]) => {
    onChange({ ...event, [field]: value });
  }, [event, onChange]);

  const handleStartDateChange = (value: string) => {
    const newStart = parseDateSafe(value, event.startDate);
    if (newStart === event.startDate) return; // No change if invalid
    const duration = event.endDate.getTime() - event.startDate.getTime();
    const newEnd = new Date(newStart.getTime() + duration);
    onChange({ ...event, startDate: newStart, endDate: newEnd });
  };

  const handleAddAlarm = (minutes: number) => {
    const newAlarm: Alarm = {
      action: 'DISPLAY',
      triggerType: 'BEFORE_START',
      triggerValue: minutes,
      description: `Reminder: ${event.summary}`,
    };
    const alarms = [...(event.alarms || []), newAlarm];
    handleChange('alarms', alarms);
  };

  const handleRemoveAlarm = (index: number) => {
    const alarms = event.alarms?.filter((_, i) => i !== index);
    handleChange('alarms', alarms);
  };

  const handleCategoriesChange = (value: string) => {
    setCategoriesInput(value);
    const categories = value.split(',').map(c => c.trim()).filter(c => c);
    handleChange('categories', categories);
  };

  const handleRecurrenceToggle = () => {
    if (event.recurrenceRule) {
      handleChange('recurrenceRule', undefined);
    } else {
      handleChange('recurrenceRule', { frequency: 'WEEKLY', interval: 1 });
    }
  };

  const handleWeekdayToggle = (day: WeekDay) => {
    if (!event.recurrenceRule) return;
    
    const currentDays = event.recurrenceRule.byDay || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    handleChange('recurrenceRule', { ...event.recurrenceRule, byDay: newDays });
  };

  return (
    <div className="space-y-3">
      {/* Basic Section */}
      <AccordionSection

        title="Basic"
        icon={<Calendar className="w-4 h-4" />}
        isOpen={openSections.has('basic')}
        onToggle={() => toggleSection('basic')}
      >
        <div className="space-y-4">
          <Input
            label="Event Title"
            value={event.summary}
            onChange={(e) => handleChange('summary', e.target.value)}
            placeholder="Enter event title..."
          />

          <Textarea
            label="Description"
            value={event.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Add a description..."
            rows={3}
          />

          <Input
            label="URL"
            type="url"
            value={event.url || ''}
            onChange={(e) => handleChange('url', e.target.value)}
            placeholder="https://..."
          />

          <Input
            label="Categories (comma-separated)"
            value={categoriesInput}
            onChange={(e) => handleCategoriesChange(e.target.value)}
            placeholder="Meeting, Work, Important..."
          />

          {event.categories && event.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {event.categories.map((cat, i) => (
                <Badge key={i} variant="primary">{cat}</Badge>
              ))}
            </div>
          )}
        </div>
      </AccordionSection>

      {/* Date & Time Section */}
      <AccordionSection

        title="Date & Time"
        icon={<Clock className="w-4 h-4" />}
        isOpen={openSections.has('datetime')}
        onToggle={() => toggleSection('datetime')}
      >
        <div className="space-y-4">
          <Checkbox
            label="All-day event"
            checked={event.allDay}
            onChange={(e) => handleChange('allDay', e.target.checked)}
          />

          <div className="grid grid-cols-1 gap-4">
            {event.allDay ? (
              <>
                <Input
                  label="Start Date"
                  type="date"
                  value={formatDateOnly(event.startDate)}
                  onChange={(e) => {
                    const parsed = parseDateSafe(e.target.value, event.startDate);
                    if (parsed !== event.startDate) handleChange('startDate', parsed);
                  }}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={formatDateOnly(event.endDate)}
                  onChange={(e) => {
                    const parsed = parseDateSafe(e.target.value, event.endDate);
                    if (parsed !== event.endDate) handleChange('endDate', parsed);
                  }}
                />
              </>
            ) : (
              <>
                <Input
                  label="Start"
                  type="datetime-local"
                  value={formatDateForInput(event.startDate)}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
                <Input
                  label="End"
                  type="datetime-local"
                  value={formatDateForInput(event.endDate)}
                  onChange={(e) => {
                    const parsed = parseDateSafe(e.target.value, event.endDate);
                    if (parsed !== event.endDate) handleChange('endDate', parsed);
                  }}
                />
              </>
            )}
          </div>

          <Select
            label="Timezone"
            value={event.timezone || 'UTC'}
            onChange={(e) => handleChange('timezone', e.target.value)}
            options={TIMEZONE_OPTIONS}
          />
        </div>
      </AccordionSection>

      {/* Location Section */}
      <AccordionSection

        title="Location"
        icon={<MapPin className="w-4 h-4" />}
        isOpen={openSections.has('location')}
        onToggle={() => toggleSection('location')}
        badge={event.location?.text ? '✓' : undefined}
      >
        <div className="space-y-4">
          <Textarea
            label="Location"
            value={event.location?.text || ''}
            onChange={(e) => handleChange('location', { 
              ...event.location, 
              text: e.target.value 
            })}
            placeholder="Enter location address..."
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={event.location?.geo?.latitude || ''}
              onChange={(e) => handleChange('location', {
                ...event.location,
                text: event.location?.text || '',
                geo: {
                  latitude: parseFloat(e.target.value) || 0,
                  longitude: event.location?.geo?.longitude || 0,
                },
              })}
              placeholder="41.149765"
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={event.location?.geo?.longitude || ''}
              onChange={(e) => handleChange('location', {
                ...event.location,
                text: event.location?.text || '',
                geo: {
                  latitude: event.location?.geo?.latitude || 0,
                  longitude: parseFloat(e.target.value) || 0,
                },
              })}
              placeholder="1.102648"
            />
          </div>

          <div className="p-3 bg-[rgb(var(--accent))] rounded-lg text-sm text-[rgb(var(--muted-foreground))]">
            💡 Add coordinates for map links in Apple/Google Calendar
          </div>
        </div>
      </AccordionSection>

      {/* Repeat Section */}
      <AccordionSection

        title="Repeat"
        icon={<Repeat className="w-4 h-4" />}
        isOpen={openSections.has('recurrence')}
        onToggle={() => toggleSection('recurrence')}
        badge={event.recurrenceRule ? '✓' : undefined}
      >
        <div className="space-y-4">
          <Checkbox
            label="Repeat this event"
            checked={!!event.recurrenceRule}
            onChange={handleRecurrenceToggle}
          />

          {event.recurrenceRule && (
            <Card className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Frequency"
                  value={event.recurrenceRule.frequency}
                  onChange={(e) => handleChange('recurrenceRule', {
                    ...event.recurrenceRule!,
                    frequency: e.target.value as RecurrenceFrequency,
                  })}
                  options={FREQUENCY_OPTIONS}
                />
                <Input
                  label="Interval"
                  type="number"
                  min={1}
                  value={event.recurrenceRule.interval || 1}
                  onChange={(e) => handleChange('recurrenceRule', {
                    ...event.recurrenceRule!,
                    interval: parseInt(e.target.value) || 1,
                  })}
                />
              </div>

              {event.recurrenceRule.frequency === 'WEEKLY' && (
                <div>
                  <label className="block text-sm font-medium text-[rgb(var(--foreground))] mb-2">
                    Repeat on
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleWeekdayToggle(day.value)}
                        className={`
                          px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                          ${event.recurrenceRule?.byDay?.includes(day.value)
                            ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
                            : 'bg-[rgb(var(--accent))] text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--accent))] hover:opacity-80'
                          }
                        `}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="End after (occurrences)"
                  type="number"
                  min={1}
                  value={event.recurrenceRule.count || ''}
                  onChange={(e) => handleChange('recurrenceRule', {
                    ...event.recurrenceRule!,
                    count: e.target.value ? parseInt(e.target.value) : undefined,
                    until: undefined,
                  })}
                  placeholder="Leave empty for no limit"
                />
                <Input
                  label="Or end by date"
                  type="date"
                  value={event.recurrenceRule.until ? formatDateOnly(event.recurrenceRule.until) : ''}
                  onChange={(e) => handleChange('recurrenceRule', {
                    ...event.recurrenceRule!,
                    until: e.target.value ? new Date(e.target.value) : undefined,
                    count: undefined,
                  })}
                />
              </div>
            </Card>
          )}
        </div>
      </AccordionSection>

      {/* Reminders Section */}
      <AccordionSection

        title="Reminders"
        icon={<Bell className="w-4 h-4" />}
        isOpen={openSections.has('reminders')}
        onToggle={() => toggleSection('reminders')}
        badge={event.alarms?.length || undefined}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {ALARM_PRESETS.slice(0, 6).map((preset) => (
              <Button
                key={preset.value}
                variant="secondary"
                size="sm"
                onClick={() => handleAddAlarm(preset.value)}
                className="text-xs"
              >
                <Plus className="w-3 h-3" />
                {preset.label}
              </Button>
            ))}
          </div>

          {event.alarms && event.alarms.length > 0 && (
            <div className="divide-y divide-[rgb(var(--border))] border border-[rgb(var(--border))] rounded-lg overflow-hidden">
              {event.alarms.map((alarm, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[rgb(var(--card))]">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
                    <span className="text-sm text-[rgb(var(--foreground))]">
                      {alarm.triggerValue === 0
                        ? 'At time of event'
                        : alarm.triggerValue < 60
                        ? `${alarm.triggerValue} min before`
                        : alarm.triggerValue < 1440
                        ? `${alarm.triggerValue / 60}h before`
                        : `${alarm.triggerValue / 1440}d before`
                      }
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAlarm(index)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(!event.alarms || event.alarms.length === 0) && (
            <div className="text-center py-6 text-[rgb(var(--muted-foreground))]">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No reminders set</p>
            </div>
          )}
        </div>
      </AccordionSection>

      {/* Advanced Section */}
      <AccordionSection

        title="Advanced"
        icon={<Settings className="w-4 h-4" />}
        isOpen={openSections.has('advanced')}
        onToggle={() => toggleSection('advanced')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Status"
              value={event.status}
              onChange={(e) => handleChange('status', e.target.value as EventStatus)}
              options={STATUS_OPTIONS}
            />
            <Select
              label="Visibility"
              value={event.classification}
              onChange={(e) => handleChange('classification', e.target.value as EventClass)}
              options={CLASS_OPTIONS}
            />
            <Select
              label="Show as"
              value={event.transparency}
              onChange={(e) => handleChange('transparency', e.target.value as TimeTransparency)}
              options={TRANSPARENCY_OPTIONS}
            />
          </div>

          <Input
            label="Priority (1-9, 1 is highest)"
            type="number"
            min={1}
            max={9}
            value={event.priority || ''}
            onChange={(e) => handleChange('priority', e.target.value ? parseInt(e.target.value) : undefined)}
          />

          <Card className="space-y-3">
            <h4 className="font-medium text-sm text-[rgb(var(--foreground))] flex items-center gap-2">
              <Users className="w-4 h-4" />
              Organizer
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Name"
                value={event.organizer?.name || ''}
                onChange={(e) => handleChange('organizer', {
                  ...event.organizer,
                  name: e.target.value,
                  email: event.organizer?.email || '',
                })}
                placeholder="John Doe"
              />
              <Input
                label="Email"
                type="email"
                value={event.organizer?.email || ''}
                onChange={(e) => handleChange('organizer', {
                  ...event.organizer,
                  email: e.target.value,
                  name: event.organizer?.name,
                })}
                placeholder="john@example.com"
              />
            </div>
          </Card>

          {/* Platform Extensions - Collapsed by default */}
          <Card className="space-y-3">
            <h4 className="font-medium text-sm text-[rgb(var(--foreground))] flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Platform Settings
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
                <Apple className="w-3.5 h-3.5" />
                Apple Calendar
              </div>
              <Select
                label="Travel Advisory"
                value={event.appleExtensions?.travelAdvisoryBehavior || 'AUTOMATIC'}
                onChange={(e) => handleChange('appleExtensions', {
                  ...event.appleExtensions,
                  travelAdvisoryBehavior: e.target.value as 'AUTOMATIC' | 'DISABLED',
                })}
                options={[
                  { value: 'AUTOMATIC', label: 'Automatic' },
                  { value: 'DISABLED', label: 'Disabled' },
                ]}
              />
            </div>

            <div className="space-y-3 pt-3 border-t border-[rgb(var(--border))]">
              <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
                <Globe className="w-3.5 h-3.5" />
                Microsoft Outlook
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Busy Status"
                  value={event.microsoftExtensions?.busyStatus || 'BUSY'}
                  onChange={(e) => handleChange('microsoftExtensions', {
                    ...event.microsoftExtensions,
                    busyStatus: e.target.value as 'FREE' | 'TENTATIVE' | 'BUSY' | 'OOF' | 'WORKING_ELSEWHERE',
                  })}
                  options={[
                    { value: 'FREE', label: 'Free' },
                    { value: 'TENTATIVE', label: 'Tentative' },
                    { value: 'BUSY', label: 'Busy' },
                    { value: 'OOF', label: 'Out of Office' },
                    { value: 'WORKING_ELSEWHERE', label: 'Elsewhere' },
                  ]}
                />
                <Select
                  label="Importance"
                  value={event.microsoftExtensions?.importance || 'NORMAL'}
                  onChange={(e) => handleChange('microsoftExtensions', {
                    ...event.microsoftExtensions,
                    importance: e.target.value as 'LOW' | 'NORMAL' | 'HIGH',
                  })}
                  options={[
                    { value: 'LOW', label: 'Low' },
                    { value: 'NORMAL', label: 'Normal' },
                    { value: 'HIGH', label: 'High' },
                  ]}
                />
              </div>
            </div>
          </Card>
        </div>
      </AccordionSection>

      {/* Service Info */}
      <div className="mt-6 p-4 bg-[rgb(var(--accent))] rounded-xl border border-[rgb(var(--border))]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[rgb(var(--primary))] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[rgb(var(--primary-foreground))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-[rgb(var(--foreground))]">
              {t.universalCalendarSupport}
            </p>
            <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
              {t.serviceDescription}
            </p>
          </div>
        </div>
      </div>

      {/* Actions - Sticky on mobile */}
      <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-[rgb(var(--card))] border-t border-[rgb(var(--border))] flex gap-3 sm:static sm:mx-0 sm:mb-0 sm:px-0 sm:border-0 sm:pt-4">
        <Button variant="ghost" onClick={onCancel} className="flex-1 sm:flex-none">
          Cancel
        </Button>
        <Button onClick={onSave} className="flex-1 sm:flex-none">
          Save Event
        </Button>
      </div>
    </div>
  );
}
