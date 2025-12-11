/**
 * Event Form Component
 * Comprehensive form for creating/editing calendar events
 */

import { useState, useCallback } from 'react';
import { CalendarEvent, RecurrenceFrequency, WeekDay, EventClass, EventStatus, TimeTransparency, Alarm, COMMON_TIMEZONES } from '@/types';
import { Button, Input, Textarea, Select, Checkbox, Card, Tabs, Badge } from '@/components/ui';
import { Calendar, Clock, MapPin, Users, Bell, Repeat, Globe, Settings, Plus, Trash2, Apple } from 'lucide-react';

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

export function EventForm({ event, onChange, onSave, onCancel }: EventFormProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [categoriesInput, setCategoriesInput] = useState(event.categories?.join(', ') || '');

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

  const tabs = [
    { id: 'basic', label: 'Basic', icon: <Calendar className="w-4 h-4" /> },
    { id: 'datetime', label: 'Date & Time', icon: <Clock className="w-4 h-4" /> },
    { id: 'location', label: 'Location', icon: <MapPin className="w-4 h-4" /> },
    { id: 'recurrence', label: 'Repeat', icon: <Repeat className="w-4 h-4" /> },
    { id: 'reminders', label: 'Reminders', icon: <Bell className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="min-h-[400px]">
        {/* Basic Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-4 animate-fade-in">
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
              rows={4}
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
        )}

        {/* Date & Time Tab */}
        {activeTab === 'datetime' && (
          <div className="space-y-4 animate-fade-in">
            <Checkbox
              label="All-day event"
              checked={event.allDay}
              onChange={(e) => handleChange('allDay', e.target.checked)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    label="Start Date & Time"
                    type="datetime-local"
                    value={formatDateForInput(event.startDate)}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                  <Input
                    label="End Date & Time"
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
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="space-y-4 animate-fade-in">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                💡 Tip: Add coordinates to enable map links in Apple and Google Calendar.
              </p>
            </div>
          </div>
        )}

        {/* Recurrence Tab */}
        {activeTab === 'recurrence' && (
          <div className="space-y-4 animate-fade-in">
            <Checkbox
              label="Repeat this event"
              checked={!!event.recurrenceRule}
              onChange={handleRecurrenceToggle}
            />

            {event.recurrenceRule && (
              <Card className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Repeat on
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => handleWeekdayToggle(day.value)}
                          className={`
                            px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                            ${event.recurrenceRule?.byDay?.includes(day.value)
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                            }
                          `}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    label="End by date"
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
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-wrap gap-2">
              {ALARM_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddAlarm(preset.value)}
                >
                  <Plus className="w-3 h-3" />
                  {preset.label}
                </Button>
              ))}
            </div>

            {event.alarms && event.alarms.length > 0 && (
              <Card className="divide-y divide-gray-200 dark:divide-slate-700" padding="none">
                {event.alarms.map((alarm, index) => (
                  <div key={index} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {alarm.triggerValue === 0
                          ? 'At time of event'
                          : alarm.triggerValue < 60
                          ? `${alarm.triggerValue} minutes before`
                          : alarm.triggerValue < 1440
                          ? `${alarm.triggerValue / 60} hour${alarm.triggerValue / 60 > 1 ? 's' : ''} before`
                          : `${alarm.triggerValue / 1440} day${alarm.triggerValue / 1440 > 1 ? 's' : ''} before`
                        }
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAlarm(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </Card>
            )}

            {(!event.alarms || event.alarms.length === 0) && (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No reminders set</p>
                <p className="text-sm">Click a preset above to add a reminder</p>
              </div>
            )}
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <Card className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Organizer
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Platform-specific settings */}
            <Card className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Platform Extensions
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <Apple className="w-4 h-4" />
                  <span>Apple Calendar</span>
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

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <Globe className="w-4 h-4" />
                  <span>Microsoft Outlook</span>
                </div>
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
                    { value: 'WORKING_ELSEWHERE', label: 'Working Elsewhere' },
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
            </Card>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          Save Event
        </Button>
      </div>
    </div>
  );
}
