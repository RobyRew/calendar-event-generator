/**
 * Event List Component
 * Displays a list of calendar events with actions
 */

import React from 'react';
import { CalendarEvent } from '@/types';
import { Card, Button, Badge } from '@/components/ui';
import { Calendar, Clock, MapPin, Repeat, Bell, Trash2, Edit, Copy, FileText } from 'lucide-react';
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
        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-slate-600" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-1">
          No events yet
        </h3>
        <p className="text-gray-500 dark:text-slate-400">
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

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <Card
          key={event.uid}
          padding="none"
          className={`
            cursor-pointer transition-all duration-200 overflow-hidden
            hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700
            ${selectedEventId === event.uid ? 'ring-2 ring-primary-500 border-primary-500' : ''}
          `}
        >
          <div className="p-4" onClick={() => onSelect(event.uid)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                  {event.summary}
                </h4>
                
                <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{formatEventDate(event)}</span>
                </div>
                
                {event.location?.text && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-slate-400">
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
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
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

            {/* Source file indicator */}
            {event.sourceFile && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400 dark:text-slate-500">
                <FileText className="w-3 h-3" />
                <span className="truncate">From: {event.sourceFile}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-1 px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700">
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
      ))}
    </div>
  );
}
