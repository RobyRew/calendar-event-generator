/**
 * Import/Export Panel Component
 * Handles ICS file import, export, and calendar links
 */

import React, { useRef, useState } from 'react';
import { CalendarEvent, Calendar } from '@/types';
import { Button, Card } from '@/components/ui';
import { 
  Upload, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  ExternalLink,
  Apple,
  Chrome
} from 'lucide-react';
import { 
  generateICS, 
  generateEventICS, 
  downloadICS,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
  generateOffice365Url,
  generateYahooCalendarUrl 
} from '@/lib';
import { parseICSFile } from '@/lib';

interface ImportExportPanelProps {
  calendar: Calendar;
  selectedEvent: CalendarEvent | null;
  onImport: (calendar: Calendar) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

export function ImportExportPanel({ 
  calendar, 
  selectedEvent, 
  onImport, 
  onError, 
  onSuccess 
}: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const calendar = await parseICSFile(file);
      onImport(calendar);
      onSuccess(`Imported ${calendar.events.length} event(s) successfully!`);
    } catch (error) {
      onError(`Failed to parse ICS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportAll = () => {
    if (calendar.events.length === 0) {
      onError('No events to export');
      return;
    }

    const content = generateICS(calendar);
    downloadICS(content, 'calendar.ics');
    onSuccess('Calendar exported successfully!');
  };

  const handleExportSelected = () => {
    if (!selectedEvent) {
      onError('No event selected');
      return;
    }

    const content = generateEventICS(selectedEvent);
    const filename = `${selectedEvent.summary.replace(/[^a-z0-9]/gi, '_')}.ics`;
    downloadICS(content, filename);
    onSuccess('Event exported successfully!');
  };

  const handlePreview = () => {
    if (selectedEvent) {
      setPreviewContent(generateEventICS(selectedEvent));
    } else if (calendar.events.length > 0) {
      setPreviewContent(generateICS(calendar));
    } else {
      onError('No events to preview');
    }
  };

  const handleCopyLink = async (type: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(type);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      onError('Failed to copy link');
    }
  };

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const calendarLinks = selectedEvent ? [
    {
      type: 'google',
      label: 'Google Calendar',
      icon: <Chrome className="w-4 h-4" />,
      color: 'text-blue-600',
      url: generateGoogleCalendarUrl(selectedEvent),
    },
    {
      type: 'outlook',
      label: 'Outlook.com',
      icon: <span className="w-4 h-4 font-bold text-xs">O</span>,
      color: 'text-blue-500',
      url: generateOutlookUrl(selectedEvent),
    },
    {
      type: 'office365',
      label: 'Office 365',
      icon: <span className="w-4 h-4 font-bold text-xs">365</span>,
      color: 'text-orange-500',
      url: generateOffice365Url(selectedEvent),
    },
    {
      type: 'yahoo',
      label: 'Yahoo Calendar',
      icon: <span className="w-4 h-4 font-bold text-xs">Y!</span>,
      color: 'text-purple-600',
      url: generateYahooCalendarUrl(selectedEvent),
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card>
        <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import
        </h3>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,.ical,.ifb"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4" />
          Import ICS File
        </Button>
        
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          Supports .ics, .ical, and .ifb files from any calendar application
        </p>
      </Card>

      {/* Export Section */}
      <Card>
        <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export
        </h3>
        
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={handleExportAll}
            disabled={calendar.events.length === 0}
          >
            <Download className="w-4 h-4" />
            Export All Events ({calendar.events.length})
          </Button>
          
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleExportSelected}
            disabled={!selectedEvent}
          >
            <Download className="w-4 h-4" />
            Export Selected Event
          </Button>
          
          <Button
            variant="ghost"
            className="w-full"
            onClick={handlePreview}
            disabled={calendar.events.length === 0}
          >
            <FileText className="w-4 h-4" />
            Preview ICS
          </Button>
        </div>
      </Card>

      {/* Quick Add Links */}
      {selectedEvent && (
        <Card>
          <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Add to Calendar
          </h3>
          
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
            Quick links for: <strong>{selectedEvent.summary}</strong>
          </p>
          
          <div className="space-y-2">
            {calendarLinks.map((link) => (
              <div 
                key={link.type}
                className="flex items-center gap-2"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => openLink(link.url)}
                >
                  <span className={link.color}>{link.icon}</span>
                  {link.label}
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyLink(link.type, link.url)}
                >
                  {copiedLink === link.type ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const content = generateEventICS(selectedEvent);
                downloadICS(content, `${selectedEvent.summary.replace(/[^a-z0-9]/gi, '_')}.ics`);
              }}
            >
              <Apple className="w-4 h-4" />
              Download for Apple Calendar
            </Button>
          </div>
        </Card>
      )}

      {/* ICS Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-medium text-gray-900 dark:text-slate-100">
                ICS Preview
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(previewContent);
                    onSuccess('Copied to clipboard!');
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewContent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto mt-4 p-4 bg-gray-50 dark:bg-slate-900 rounded-lg text-xs font-mono text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
              {previewContent}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
