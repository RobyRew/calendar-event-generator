/**
 * Export Options Component
 * Export events to various formats: ICS, JSON, Markdown, CSV, Google Calendar URL, Outlook URL
 */

import { useState } from 'react';
import { CalendarEvent, Calendar, EventLocation } from '@/types';
import { useI18n } from '@/context/I18nContext';
import { generateICS } from '@/lib';
import { Button, Card } from '@/components/ui';
import {
  Download,
  FileText,
  FileJson,
  FileSpreadsheet,
  ExternalLink,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

type ExportFormat = 'ics' | 'json' | 'markdown' | 'csv' | 'google' | 'outlook';

interface ExportOptionsProps {
  calendar: Calendar;
  selectedEvent: CalendarEvent | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// Helper to get location string
const getLocationString = (location: EventLocation | undefined): string => {
  if (!location) return '';
  return location.text || '';
};

export function ExportOptions({ calendar, selectedEvent, onClose, onSuccess }: ExportOptionsProps) {
  const { t } = useI18n();
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [copied, setCopied] = useState(false);

  const eventsToExport = exportScope === 'selected' && selectedEvent 
    ? [selectedEvent] 
    : calendar.events;

  // Format date for various outputs
  const formatDate = (date: Date, includeTime = true) => {
    if (includeTime) {
      return format(date, "yyyy-MM-dd HH:mm");
    }
    return format(date, "yyyy-MM-dd");
  };

  // Format for Google Calendar URL
  const formatGoogleDate = (date: Date, allDay: boolean) => {
    if (allDay) {
      return format(date, "yyyyMMdd");
    }
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  // Generate ICS file
  const exportICS = () => {
    const calendarToExport: Calendar = {
      ...calendar,
      events: eventsToExport,
    };
    const icsContent = generateICS(calendarToExport);
    downloadFile(icsContent, 'calendar-events.ics', 'text/calendar');
    onSuccess(t.exportSuccess);
  };

  // Generate JSON file
  const exportJSON = () => {
    const data = {
      exported: new Date().toISOString(),
      eventCount: eventsToExport.length,
      events: eventsToExport.map(event => ({
        uid: event.uid,
        summary: event.summary,
        description: event.description,
        location: getLocationString(event.location),
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        allDay: event.allDay,
        categories: event.categories,
        url: event.url,
        status: event.status,
        recurrenceRule: event.recurrenceRule,
        alarms: event.alarms,
        attendees: event.attendees,
        organizer: event.organizer,
        color: event.color,
        created: event.created?.toISOString(),
        lastModified: event.lastModified?.toISOString(),
      })),
    };
    const jsonContent = JSON.stringify(data, null, 2);
    downloadFile(jsonContent, 'calendar-events.json', 'application/json');
    onSuccess(t.exportSuccess);
  };

  // Generate Markdown file
  const exportMarkdown = () => {
    let md = `# Calendar Events\n\n`;
    md += `*Exported on ${format(new Date(), 'MMMM d, yyyy')}*\n\n`;
    md += `**Total Events:** ${eventsToExport.length}\n\n`;
    md += `---\n\n`;

    // Sort by date
    const sortedEvents = [...eventsToExport].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    sortedEvents.forEach(event => {
      md += `## ${event.summary}\n\n`;
      
      if (event.allDay) {
        md += `📅 **Date:** ${format(event.startDate, 'EEEE, MMMM d, yyyy')} (All Day)\n\n`;
      } else {
        md += `📅 **Start:** ${format(event.startDate, 'EEEE, MMMM d, yyyy \'at\' h:mm a')}\n\n`;
        md += `📅 **End:** ${format(event.endDate, 'EEEE, MMMM d, yyyy \'at\' h:mm a')}\n\n`;
      }

      if (event.location) {
        md += `📍 **Location:** ${event.location}\n\n`;
      }

      if (event.description) {
        md += `📝 **Description:**\n\n${event.description}\n\n`;
      }

      if (event.url) {
        md += `🔗 **URL:** [${event.url}](${event.url})\n\n`;
      }

      if (event.categories && event.categories.length > 0) {
        md += `🏷️ **Categories:** ${event.categories.join(', ')}\n\n`;
      }

      if (event.attendees && event.attendees.length > 0) {
        md += `👥 **Attendees:**\n`;
        event.attendees.forEach(att => {
          md += `- ${att.name || att.email}\n`;
        });
        md += '\n';
      }

      md += `---\n\n`;
    });

    downloadFile(md, 'calendar-events.md', 'text/markdown');
    onSuccess(t.exportSuccess);
  };

  // Generate CSV file
  const exportCSV = () => {
    const headers = [
      'Summary',
      'Start Date',
      'End Date',
      'All Day',
      'Location',
      'Description',
      'Categories',
      'URL',
      'Status',
    ];

    const escapeCSV = (value: string | undefined | null) => {
      if (!value) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csv = headers.join(',') + '\n';

    eventsToExport.forEach(event => {
      const row = [
        escapeCSV(event.summary),
        formatDate(event.startDate, !event.allDay),
        formatDate(event.endDate, !event.allDay),
        event.allDay ? 'Yes' : 'No',
        escapeCSV(getLocationString(event.location)),
        escapeCSV(event.description),
        escapeCSV(event.categories?.join('; ')),
        escapeCSV(event.url),
        escapeCSV(event.status),
      ];
      csv += row.join(',') + '\n';
    });

    downloadFile(csv, 'calendar-events.csv', 'text/csv');
    onSuccess(t.exportSuccess);
  };

  // Generate Google Calendar URL
  const getGoogleCalendarURL = (event: CalendarEvent) => {
    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', event.summary);
    
    if (event.allDay) {
      params.set('dates', `${formatGoogleDate(event.startDate, true)}/${formatGoogleDate(event.endDate, true)}`);
    } else {
      params.set('dates', `${formatGoogleDate(event.startDate, false)}/${formatGoogleDate(event.endDate, false)}`);
    }
    
    const loc = getLocationString(event.location);
    if (loc) params.set('location', loc);
    if (event.description) params.set('details', event.description);
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Generate Outlook Web URL  
  const getOutlookURL = (event: CalendarEvent) => {
    const params = new URLSearchParams();
    params.set('path', '/calendar/action/compose');
    params.set('rru', 'addevent');
    params.set('subject', event.summary);
    params.set('startdt', event.startDate.toISOString());
    params.set('enddt', event.endDate.toISOString());
    if (event.allDay) params.set('allday', 'true');
    const outlookLoc = getLocationString(event.location);
    if (outlookLoc) params.set('location', outlookLoc);
    if (event.description) params.set('body', event.description);
    
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  // Copy URL to clipboard
  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download helper
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFormats: { id: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'ics',
      label: t.exportICS,
      icon: <FileText className="w-5 h-5" />,
      description: 'Standard calendar format for all apps',
    },
    {
      id: 'json',
      label: t.exportJSON,
      icon: <FileJson className="w-5 h-5" />,
      description: 'Full event data for developers',
    },
    {
      id: 'markdown',
      label: t.exportMarkdown,
      icon: <FileText className="w-5 h-5" />,
      description: 'Readable format for documentation',
    },
    {
      id: 'csv',
      label: t.exportCSV,
      icon: <FileSpreadsheet className="w-5 h-5" />,
      description: 'Spreadsheet compatible format',
    },
  ];

  const handleExport = (format: ExportFormat) => {
    switch (format) {
      case 'ics':
        exportICS();
        break;
      case 'json':
        exportJSON();
        break;
      case 'markdown':
        exportMarkdown();
        break;
      case 'csv':
        exportCSV();
        break;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t.export}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scope Selection */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex gap-2">
            <button
              onClick={() => setExportScope('all')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                exportScope === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {t.exportAll} ({calendar.events.length})
            </button>
            <button
              onClick={() => setExportScope('selected')}
              disabled={!selectedEvent}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                exportScope === 'selected'
                  ? 'bg-primary-500 text-white'
                  : selectedEvent
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              {t.exportSelected}
            </button>
          </div>
          
          {/* Show selected event info when export scope is selected */}
          {exportScope === 'selected' && selectedEvent && (
            <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <p className="text-xs text-primary-600 dark:text-primary-400 font-medium uppercase tracking-wide mb-1">
                Exporting Event:
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedEvent.summary}
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {selectedEvent.allDay 
                  ? format(selectedEvent.startDate, 'EEEE, MMMM d, yyyy')
                  : format(selectedEvent.startDate, 'EEEE, MMMM d, yyyy \'at\' h:mm a')
                }
              </p>
            </div>
          )}
        </div>

        {/* Export Formats */}
        <div className="p-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">
            {t.exportFormat}
          </h3>
          
          {exportFormats.map(format => (
            <button
              key={format.id}
              onClick={() => handleExport(format.id)}
              className="w-full flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-slate-300">
                {format.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {format.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  {format.description}
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>

        {/* Web Calendar Links (for single event) */}
        {(exportScope === 'selected' && selectedEvent) && (
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">
              Open in Web Calendar
            </h3>
            <div className="space-y-2">
              {/* Google Calendar */}
              <div className="flex items-center gap-2">
                <a
                  href={getGoogleCalendarURL(selectedEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-primary-500 transition-colors"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                    alt="Google Calendar"
                    className="w-6 h-6"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {t.exportGoogleCalendar}
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                </a>
                <button
                  onClick={() => copyToClipboard(getGoogleCalendarURL(selectedEvent))}
                  className="p-3 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  title="Copy URL"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Outlook */}
              <div className="flex items-center gap-2">
                <a
                  href={getOutlookURL(selectedEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-primary-500 transition-colors"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg"
                    alt="Outlook"
                    className="w-6 h-6"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {t.exportOutlook}
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <Button variant="outline" onClick={onClose} className="w-full">
            {t.close}
          </Button>
        </div>
      </Card>
    </div>
  );
}
