/**
 * Storage utilities for persisting app data
 * Uses localStorage with IndexedDB fallback for larger data
 */

import { CalendarEvent } from '@/types';

const STORAGE_KEY = 'calendar_events';
const SETTINGS_KEY = 'calendar_settings';

export interface AppSettings {
  theme: string;
  language: string;
  viewMode: 'list' | 'calendar';
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  language: 'en',
  viewMode: 'list',
};

// Serialize dates for JSON storage
function serializeEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    startDate: event.startDate instanceof Date ? event.startDate.toISOString() : event.startDate,
    endDate: event.endDate instanceof Date ? event.endDate.toISOString() : event.endDate,
    created: event.created instanceof Date ? event.created.toISOString() : event.created,
    lastModified: event.lastModified instanceof Date ? event.lastModified.toISOString() : event.lastModified,
  } as unknown as CalendarEvent;
}

// Deserialize dates from JSON storage
function deserializeEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
    created: event.created ? new Date(event.created) : new Date(),
    lastModified: event.lastModified ? new Date(event.lastModified) : new Date(),
  };
}

/**
 * Save events to localStorage
 */
export function saveEvents(events: CalendarEvent[]): boolean {
  try {
    const serialized = events.map(serializeEvent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    return true;
  } catch (error) {
    console.error('Failed to save events:', error);
    return false;
  }
}

/**
 * Load events from localStorage
 */
export function loadEvents(): CalendarEvent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map(deserializeEvent);
  } catch (error) {
    console.error('Failed to load events:', error);
    return [];
  }
}

/**
 * Clear all stored events
 */
export function clearEvents(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear events:', error);
    return false;
  }
}

/**
 * Save app settings
 */
export function saveSettings(settings: Partial<AppSettings>): boolean {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}

/**
 * Load app settings
 */
export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Clear all app data (events + settings)
 */
export function clearAllData(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return false;
  }
}

/**
 * Get storage usage info
 */
export function getStorageInfo(): { used: string; eventCount: number } {
  try {
    const eventsData = localStorage.getItem(STORAGE_KEY) || '';
    const settingsData = localStorage.getItem(SETTINGS_KEY) || '';
    const totalBytes = new Blob([eventsData, settingsData]).size;
    
    const events = loadEvents();
    
    // Format size
    let used: string;
    if (totalBytes < 1024) {
      used = `${totalBytes} B`;
    } else if (totalBytes < 1024 * 1024) {
      used = `${(totalBytes / 1024).toFixed(1)} KB`;
    } else {
      used = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    
    return { used, eventCount: events.length };
  } catch {
    return { used: '0 B', eventCount: 0 };
  }
}
