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
  onImport: (events: CalendarEvent[]) => void;
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
  const [isDragging, setIsDragging] = useState(false);

  // Process files (used by both file input and drag/drop)
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    let totalImported = 0;
    const errors: string[] = [];
    const allEvents: CalendarEvent[] = [];

    for (const file of fileArray) {
      // Check file extension
      const ext = file.name.toLowerCase().split('.').pop();
      if (!['ics', 'ical', 'ifb'].includes(ext || '')) {
        errors.push(`${file.name}: Not a valid calendar file`);
        continue;
      }

      try {
        const parsedCalendar = await parseICSFile(file);
        const eventsWithSource = parsedCalendar.events.map(event => ({
          ...event,
          sourceFile: file.name,
        }));
        allEvents.push(...eventsWithSource);
        totalImported += eventsWithSource.length;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (allEvents.length > 0) {
      onImport(allEvents);
      onSuccess(`Added ${totalImported} event(s) from ${fileArray.length} file(s)!`);
    }
    
    if (errors.length > 0) {
      onError(`Failed: ${errors.join(', ')}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    await processFiles(files);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
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
      color: 'text-[rgb(var(--foreground))]',
      url: generateGoogleCalendarUrl(selectedEvent),
    },
    {
      type: 'outlook',
      label: 'Outlook.com',
      icon: <span className="w-4 h-4 font-bold text-xs">O</span>,
      color: 'text-[rgb(var(--foreground))]',
      url: generateOutlookUrl(selectedEvent),
    },
    {
      type: 'office365',
      label: 'Office 365',
      icon: <span className="w-4 h-4 font-bold text-xs">365</span>,
      color: 'text-[rgb(var(--muted-foreground))]',
      url: generateOffice365Url(selectedEvent),
    },
    {
      type: 'yahoo',
      label: 'Yahoo Calendar',
      icon: <span className="w-4 h-4 font-bold text-xs">Y!</span>,
      color: 'text-[rgb(var(--muted-foreground))]',
      url: generateYahooCalendarUrl(selectedEvent),
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card>
        <h3 className="font-medium text-[rgb(var(--foreground))] mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import
        </h3>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,.ical,.ifb"
          onChange={handleFileSelect}
          multiple
          className="hidden"
        />
        
        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
              : 'border-[rgb(var(--border))] hover:border-[rgb(var(--primary))] hover:bg-[rgb(var(--accent))]'
            }
          `}
        >
          <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-primary-500' : 'text-[rgb(var(--muted-foreground))]'}`} />
          <p className="text-sm font-medium text-[rgb(var(--foreground))]">
            {isDragging ? 'Drop files here...' : 'Drag & drop ICS files here'}
          </p>
          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
            or click to browse
          </p>
        </div>
        
        <p className="mt-3 text-xs text-[rgb(var(--muted-foreground))]">
          Supports .ics, .ical, and .ifb files • Multiple files supported
        </p>
      </Card>

      {/* Export Section */}
      <Card>
        <h3 className="font-medium text-[rgb(var(--foreground))] mb-4 flex items-center gap-2">
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
          <h3 className="font-medium text-[rgb(var(--foreground))] mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Add to Calendar
          </h3>
          
          <p className="text-sm text-[rgb(var(--muted-foreground))] mb-3">
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
          
          <div className="mt-4 pt-4 border-t border-[rgb(var(--border))]">
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
            <div className="flex items-center justify-between pb-4 border-b border-[rgb(var(--border))]">
              <h3 className="font-medium text-[rgb(var(--foreground))]">
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
            <pre className="flex-1 overflow-auto mt-4 p-4 bg-[rgb(var(--accent))] rounded-lg text-xs font-mono text-[rgb(var(--foreground))] whitespace-pre-wrap">
              {previewContent}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
