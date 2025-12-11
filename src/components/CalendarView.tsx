/**
 * Calendar View Component
 * Month, Week, Day, and Agenda views for visualizing events
 */

import { useState, useMemo } from 'react';
import { CalendarEvent } from '@/types';
import { Card, Badge, Button } from '@/components/ui';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  List,
  Grid3X3,
  Clock
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
  startOfDay,
  getHours,
} from 'date-fns';

type ViewType = 'month' | 'week' | 'day' | 'agenda';

interface CalendarViewProps {
  events: CalendarEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onSelectDate: (date: Date) => void;
}

// Event color based on color property or default - grayscale palette
const getEventColor = (event: CalendarEvent): string => {
  if (event.color) return event.color;
  // Default colors based on categories or status - using grayscale
  if (event.categories?.includes('Work')) return 'bg-neutral-700';
  if (event.categories?.includes('Personal')) return 'bg-neutral-500';
  if (event.categories?.includes('Meeting')) return 'bg-neutral-600';
  if (event.status === 'TENTATIVE') return 'bg-neutral-400';
  if (event.status === 'CANCELLED') return 'bg-neutral-300';
  return 'bg-[rgb(var(--primary))]';
};

export function CalendarView({ events, selectedEventId, onSelectEvent, onSelectDate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('month');

  // Navigation handlers
  const navigatePrev = () => {
    switch (viewType) {
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(subDays(currentDate, 1));
        break;
      case 'agenda':
        setCurrentDate(subMonths(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewType) {
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'agenda':
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Get events for a specific day
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventStart = startOfDay(event.startDate);
      const eventEnd = startOfDay(event.endDate);
      const dayStart = startOfDay(day);
      return dayStart >= eventStart && dayStart <= eventEnd;
    });
  };

  // Month view days
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Week view days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Hours for day/week view
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Agenda view - upcoming events
  const agendaEvents = useMemo(() => {
    const start = startOfDay(currentDate);
    const end = addMonths(start, 1);
    return events
      .filter(e => e.startDate >= start && e.startDate <= end)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [events, currentDate]);

  // Get title based on view
  const getViewTitle = (): string => {
    switch (viewType) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'agenda':
        return `Agenda - ${format(currentDate, 'MMMM yyyy')}`;
    }
  };

  const viewButtons: { type: ViewType; icon: React.ReactNode; label: string }[] = [
    { type: 'month', icon: <Grid3X3 className="w-4 h-4" />, label: 'Month' },
    { type: 'week', icon: <CalendarIcon className="w-4 h-4" />, label: 'Week' },
    { type: 'day', icon: <Clock className="w-4 h-4" />, label: 'Day' },
    { type: 'agenda', icon: <List className="w-4 h-4" />, label: 'Agenda' },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
          <h2 className="text-lg font-semibold text-[rgb(var(--foreground))] ml-2">
            {getViewTitle()}
          </h2>
        </div>
        
        <div className="flex items-center gap-1 bg-[rgb(var(--accent))] rounded-lg p-1">
          {viewButtons.map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => setViewType(type)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${viewType === type 
                  ? 'bg-[rgb(var(--card))] text-[rgb(var(--foreground))] shadow-sm' 
                  : 'text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]'
                }
              `}
              title={label}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-2">
        {/* Month View */}
        {viewType === 'month' && (
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-[rgb(var(--muted-foreground))] py-2">
                  {day}
                </div>
              ))}
            </div>
            {/* Days grid */}
            <div className="grid grid-cols-7 gap-px bg-[rgb(var(--border))] rounded-lg overflow-hidden">
              {monthDays.map(day => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = isToday(day);
                
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => onSelectDate(day)}
                    className={`
                      min-h-[80px] p-1 bg-[rgb(var(--card))] cursor-pointer
                      hover:bg-[rgb(var(--accent))] transition-colors
                      ${!isCurrentMonth ? 'opacity-40' : ''}
                    `}
                  >
                    <div className={`
                      text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full
                      ${isSelected ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]' : 'text-[rgb(var(--foreground))]'}
                    `}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(event => (
                        <div
                          key={event.uid}
                          onClick={(e) => { e.stopPropagation(); onSelectEvent(event.uid); }}
                          className={`
                            text-xs px-1.5 py-0.5 rounded truncate cursor-pointer
                            ${getEventColor(event)} text-white
                            ${selectedEventId === event.uid ? 'ring-2 ring-offset-1 ring-primary-500' : ''}
                          `}
                          title={event.summary}
                        >
                          {event.summary}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-[rgb(var(--muted-foreground))] px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewType === 'week' && (
          <div className="overflow-auto max-h-[600px]">
            <div className="grid grid-cols-8 min-w-[800px]">
              {/* Time column */}
              <div className="sticky left-0 bg-[rgb(var(--card))] z-10">
                <div className="h-12 border-b border-[rgb(var(--border))]" />
                {hours.map(hour => (
                  <div key={hour} className="h-12 text-xs text-[rgb(var(--muted-foreground))] pr-2 text-right">
                    {format(new Date().setHours(hour, 0), 'ha')}
                  </div>
                ))}
              </div>
              
              {/* Day columns */}
              {weekDays.map(day => {
                const dayEvents = getEventsForDay(day);
                return (
                  <div key={day.toISOString()} className="border-l border-[rgb(var(--border))]">
                    {/* Day header */}
                    <div 
                      onClick={() => onSelectDate(day)}
                      className={`
                        h-12 flex flex-col items-center justify-center border-b border-[rgb(var(--border))]
                        cursor-pointer hover:bg-[rgb(var(--accent))]
                        ${isToday(day) ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
                      `}
                    >
                      <span className="text-xs text-[rgb(var(--muted-foreground))]">
                        {format(day, 'EEE')}
                      </span>
                      <span className={`
                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                        ${isToday(day) ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]' : 'text-[rgb(var(--foreground))]'}
                      `}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    
                    {/* Hour slots */}
                    <div className="relative">
                      {hours.map(hour => (
                        <div 
                          key={hour} 
                          className="h-12 border-b border-[rgb(var(--border)/0.5)]"
                        />
                      ))}
                      
                      {/* Events */}
                      {dayEvents.map(event => {
                        const startHour = getHours(event.startDate);
                        const endHour = getHours(event.endDate);
                        const duration = endHour - startHour || 1;
                        
                        return (
                          <div
                            key={event.uid}
                            onClick={() => onSelectEvent(event.uid)}
                            className={`
                              absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-xs text-white
                              cursor-pointer overflow-hidden
                              ${getEventColor(event)}
                              ${selectedEventId === event.uid ? 'ring-2 ring-offset-1 ring-primary-500' : ''}
                            `}
                            style={{
                              top: `${startHour * 48}px`,
                              height: `${duration * 48 - 4}px`,
                            }}
                            title={event.summary}
                          >
                            <div className="font-medium truncate">{event.summary}</div>
                            <div className="opacity-75 truncate">
                              {format(event.startDate, 'h:mm a')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewType === 'day' && (
          <div className="overflow-auto max-h-[600px]">
            <div className="grid grid-cols-[60px_1fr] min-w-[400px]">
              {/* Time column */}
              <div className="sticky left-0 bg-[rgb(var(--card))] z-10">
                {hours.map(hour => (
                  <div key={hour} className="h-16 text-xs text-[rgb(var(--muted-foreground))] pr-2 text-right">
                    {format(new Date().setHours(hour, 0), 'h a')}
                  </div>
                ))}
              </div>
              
              {/* Events column */}
              <div className="relative border-l border-[rgb(var(--border))]">
                {hours.map(hour => (
                  <div 
                    key={hour} 
                    className="h-16 border-b border-[rgb(var(--border)/0.5)]"
                  />
                ))}
                
                {/* Events */}
                {getEventsForDay(currentDate).map(event => {
                  const startHour = getHours(event.startDate);
                  const endHour = getHours(event.endDate);
                  const duration = endHour - startHour || 1;
                  
                  return (
                    <div
                      key={event.uid}
                      onClick={() => onSelectEvent(event.uid)}
                      className={`
                        absolute left-1 right-1 rounded-lg px-3 py-2 text-white
                        cursor-pointer overflow-hidden
                        ${getEventColor(event)}
                        ${selectedEventId === event.uid ? 'ring-2 ring-offset-2 ring-primary-500' : ''}
                      `}
                      style={{
                        top: `${startHour * 64}px`,
                        height: `${duration * 64 - 8}px`,
                      }}
                    >
                      <div className="font-medium">{event.summary}</div>
                      <div className="text-sm opacity-75">
                        {format(event.startDate, 'h:mm a')} - {format(event.endDate, 'h:mm a')}
                      </div>
                      {event.location?.text && (
                        <div className="text-sm opacity-75 truncate">{event.location.text}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Agenda View */}
        {viewType === 'agenda' && (
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {agendaEvents.length === 0 ? (
              <div className="text-center py-8 text-[rgb(var(--muted-foreground))]">
                No events in this period
              </div>
            ) : (
              agendaEvents.map(event => (
                <div
                  key={event.uid}
                  onClick={() => onSelectEvent(event.uid)}
                  className={`
                    flex items-start gap-4 p-3 rounded-lg cursor-pointer
                    hover:bg-[rgb(var(--accent))] transition-colors
                    ${selectedEventId === event.uid ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' : ''}
                  `}
                >
                  {/* Color indicator */}
                  <div className={`w-1 self-stretch rounded-full ${getEventColor(event)}`} />
                  
                  {/* Date */}
                  <div className="text-center min-w-[50px]">
                    <div className="text-2xl font-bold text-[rgb(var(--foreground))]">
                      {format(event.startDate, 'd')}
                    </div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))] uppercase">
                      {format(event.startDate, 'MMM')}
                    </div>
                  </div>
                  
                  {/* Event details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[rgb(var(--foreground))]">
                      {event.summary}
                    </div>
                    <div className="text-sm text-[rgb(var(--muted-foreground))]">
                      {event.allDay 
                        ? 'All day'
                        : `${format(event.startDate, 'h:mm a')} - ${format(event.endDate, 'h:mm a')}`
                      }
                    </div>
                    {event.location?.text && (
                      <div className="text-sm text-[rgb(var(--muted-foreground))] truncate">
                        📍 {event.location.text}
                      </div>
                    )}
                  </div>
                  
                  {/* Categories */}
                  {event.categories && event.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.categories.slice(0, 2).map((cat, i) => (
                        <Badge key={i} variant="default" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
