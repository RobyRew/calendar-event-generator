/**
 * Event List Component
 * Displays a list of calendar events with actions
 */

import { CalendarEvent } from '@/types';
import { Card, Button, Badge } from '@/components/ui';
import { Calendar, Clock, MapPin, Repeat, Bell, Trash2, Edit, Copy, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface EventListProps {
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onDuplicate: (event: CalendarEvent) => void;
}

export function EventList({ events, selectedEventId, onSelect, onDelete, onDuplicate }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 mx-auto mb-4 text-[rgb(var(--muted-foreground)/0.3)]" />
        <h3 className="text-lg font-medium text-[rgb(var(--foreground))] mb-1">
          No events yet
        </h3>
        <p className="text-[rgb(var(--muted-foreground))]">
          Create a new event or import an ICS file to get started.
        </p>
      </div>
    );
  }

  const formatEventDate = (event: CalendarEvent): string => {
    if (event.allDay) {
      const start = format(event.startDate, 'MMM d, yyyy');
      const end = format(event.endDate, 'MMM d, yyyy');
      return start === end ? start : `${start} - ${end}`;
    }
    
    const sameDay = format(event.startDate, 'yyyy-MM-dd') === format(event.endDate, 'yyyy-MM-dd');
    if (sameDay) {
      return `${format(event.startDate, 'MMM d, yyyy • HH:mm')} - ${format(event.endDate, 'HH:mm')}`;
    }
    
    return `${format(event.startDate, 'MMM d, HH:mm')} - ${format(event.endDate, 'MMM d, HH:mm, yyyy')}`;
  };

  // Check if event was modified from its source
  const isEventModified = (event: CalendarEvent): boolean => {
    if (!event.sourceFile) return false;
    // Event is considered modified if lastModified > created
    if (event.lastModified && event.created) {
      return event.lastModified.getTime() > event.created.getTime() + 1000; // 1 second tolerance
    }
    return false;
  };

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const modified = isEventModified(event);
        
        return (
        <Card
          key={event.uid}
          padding="none"
          className={`
            cursor-pointer transition-all duration-200 overflow-hidden
            hover:shadow-md hover:border-[rgb(var(--primary)/0.5)]
            ${selectedEventId === event.uid ? 'ring-2 ring-[rgb(var(--primary))] border-[rgb(var(--primary))]' : ''}
          `}
        >
          <div className="p-4" onClick={() => onSelect(event.uid)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-[rgb(var(--foreground))] truncate">
                  {event.summary}
                </h4>
                
                <div className="flex items-center gap-2 mt-1.5 text-sm text-[rgb(var(--muted-foreground))]">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{formatEventDate(event)}</span>
                </div>
                
                {event.location?.text && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-[rgb(var(--muted-foreground))]">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{event.location.text}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {event.recurrenceRule && (
                  <Badge variant="primary" className="flex-shrink-0">
                    <Repeat className="w-3 h-3 mr-1" />
                    {event.recurrenceRule.frequency.toLowerCase()}
                  </Badge>
                )}
                {event.alarms && event.alarms.length > 0 && (
                  <Badge variant="default" className="flex-shrink-0">
                    <Bell className="w-3 h-3 mr-1" />
                    {event.alarms.length}
                  </Badge>
                )}
              </div>
            </div>

            {event.description && (
              <p className="mt-2 text-sm text-[rgb(var(--muted-foreground))] line-clamp-2">
                {event.description}
              </p>
            )}

            {event.categories && event.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {event.categories.map((cat, i) => (
                  <Badge key={i} variant="default" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}

            {/* Source file indicator with modification status */}
            {event.sourceFile && (
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                <FileText className="w-3 h-3 text-[rgb(var(--muted-foreground)/0.7)]" />
                <span className="text-[rgb(var(--muted-foreground)/0.7)] truncate">
                  From: {event.sourceFile}
                </span>
                {modified && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="w-3 h-3" />
                    Modified
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-1 px-3 py-2 bg-[rgb(var(--accent))] border-t border-[rgb(var(--border))]">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(event.uid);
              }}
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(event);
              }}
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this event?')) {
                  onDelete(event.uid);
                }
              }}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </Card>
        );
      })}
    </div>
  );
}
