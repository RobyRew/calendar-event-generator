/**
 * Calendar Context
 * Provides global state management for calendar events
 * Includes undo/redo functionality
 */

import { createContext, useContext, useReducer, useCallback, ReactNode, useState } from 'react';
import { Calendar, CalendarEvent, DEFAULT_CALENDAR, DEFAULT_EVENT } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// TYPES
// ============================================================

interface CalendarState {
  calendar: Calendar;
  selectedEventId: string | null;
  isDirty: boolean;
  error: string | null;
  successMessage: string | null;
}

type CalendarAction =
  | { type: 'SET_CALENDAR'; payload: Calendar }
  | { type: 'MERGE_EVENTS'; payload: CalendarEvent[] }
  | { type: 'ADD_EVENT'; payload: CalendarEvent }
  | { type: 'UPDATE_EVENT'; payload: CalendarEvent }
  | { type: 'DELETE_EVENT'; payload: string }
  | { type: 'SELECT_EVENT'; payload: string | null }
  | { type: 'CLEAR_EVENTS' }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUCCESS'; payload: string | null }
  | { type: 'RESTORE_STATE'; payload: CalendarState };

interface CalendarContextType {
  state: CalendarState;
  addEvent: (event: Partial<CalendarEvent>) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (eventId: string) => void;
  selectEvent: (eventId: string | null) => void;
  setCalendar: (calendar: Calendar) => void;
  mergeEvents: (events: CalendarEvent[]) => void;
  clearEvents: () => void;
  createNewEvent: () => CalendarEvent;
  setError: (error: string | null) => void;
  setSuccess: (message: string | null) => void;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// ============================================================
// REDUCER
// ============================================================

const initialState: CalendarState = {
  calendar: DEFAULT_CALENDAR,
  selectedEventId: null,
  isDirty: false,
  error: null,
  successMessage: null,
};

function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  switch (action.type) {
    case 'SET_CALENDAR':
      return {
        ...state,
        calendar: action.payload,
        isDirty: false,
      };

    case 'MERGE_EVENTS': {
      // Merge new events with existing ones
      // If an event with the same UID exists, generate a new UID
      const existingUids = new Set(state.calendar.events.map(e => e.uid));
      const newEvents = action.payload.map(e => {
        if (existingUids.has(e.uid)) {
          // Generate a new unique ID for duplicate
          return {
            ...e,
            uid: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@calendar.local`,
          };
        }
        return e;
      });
      return {
        ...state,
        calendar: {
          ...state.calendar,
          events: [...state.calendar.events, ...newEvents],
        },
        isDirty: true,
      };
    }

    case 'ADD_EVENT':
      return {
        ...state,
        calendar: {
          ...state.calendar,
          events: [...state.calendar.events, action.payload],
        },
        selectedEventId: action.payload.uid,
        isDirty: true,
      };

    case 'UPDATE_EVENT':
      return {
        ...state,
        calendar: {
          ...state.calendar,
          events: state.calendar.events.map((e) =>
            e.uid === action.payload.uid ? action.payload : e
          ),
        },
        isDirty: true,
      };

    case 'DELETE_EVENT':
      return {
        ...state,
        calendar: {
          ...state.calendar,
          events: state.calendar.events.filter((e) => e.uid !== action.payload),
        },
        selectedEventId:
          state.selectedEventId === action.payload ? null : state.selectedEventId,
        isDirty: true,
      };

    case 'SELECT_EVENT':
      return {
        ...state,
        selectedEventId: action.payload,
      };

    case 'CLEAR_EVENTS':
      return {
        ...state,
        calendar: {
          ...state.calendar,
          events: [],
        },
        selectedEventId: null,
        isDirty: true,
      };

    case 'SET_DIRTY':
      return {
        ...state,
        isDirty: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'SET_SUCCESS':
      return {
        ...state,
        successMessage: action.payload,
      };

    default:
      return state;
  }
}

// ============================================================
// CONTEXT
// ============================================================

const CalendarContext = createContext<CalendarContextType | null>(null);

const MAX_HISTORY_SIZE = 50;

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState);
  const [past, setPast] = useState<CalendarEvent[][]>([]);
  const [future, setFuture] = useState<CalendarEvent[][]>([]);

  // Track state changes that should be undoable
  const saveToHistory = useCallback((currentEvents: CalendarEvent[]) => {
    setPast(prev => {
      const newPast = [...prev, currentEvents];
      // Keep history size manageable
      if (newPast.length > MAX_HISTORY_SIZE) {
        return newPast.slice(-MAX_HISTORY_SIZE);
      }
      return newPast;
    });
    setFuture([]); // Clear redo stack on new action
  }, []);

  const createNewEvent = useCallback((): CalendarEvent => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(startDate.getHours() + 1, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    return {
      ...DEFAULT_EVENT,
      uid: `${Date.now()}-${uuidv4()}@calendar.local`,
      summary: 'New Event',
      startDate,
      endDate,
      allDay: false,
      status: 'CONFIRMED',
      classification: 'PUBLIC',
      transparency: 'OPAQUE',
      created: now,
      lastModified: now,
      sequence: 0,
    } as CalendarEvent;
  }, []);

  const addEvent = useCallback((eventData: Partial<CalendarEvent>) => {
    saveToHistory(state.calendar.events);
    const newEvent = {
      ...createNewEvent(),
      ...eventData,
    };
    dispatch({ type: 'ADD_EVENT', payload: newEvent });
  }, [createNewEvent, saveToHistory, state.calendar.events]);

  const updateEvent = useCallback((event: CalendarEvent) => {
    saveToHistory(state.calendar.events);
    const updatedEvent = {
      ...event,
      lastModified: new Date(),
      sequence: (event.sequence || 0) + 1,
    };
    dispatch({ type: 'UPDATE_EVENT', payload: updatedEvent });
  }, [saveToHistory, state.calendar.events]);

  const deleteEvent = useCallback((eventId: string) => {
    saveToHistory(state.calendar.events);
    dispatch({ type: 'DELETE_EVENT', payload: eventId });
  }, [saveToHistory, state.calendar.events]);

  const selectEvent = useCallback((eventId: string | null) => {
    dispatch({ type: 'SELECT_EVENT', payload: eventId });
  }, []);

  const setCalendar = useCallback((calendar: Calendar) => {
    saveToHistory(state.calendar.events);
    dispatch({ type: 'SET_CALENDAR', payload: calendar });
  }, [saveToHistory, state.calendar.events]);

  const mergeEvents = useCallback((events: CalendarEvent[]) => {
    saveToHistory(state.calendar.events);
    dispatch({ type: 'MERGE_EVENTS', payload: events });
  }, [saveToHistory, state.calendar.events]);

  const clearEvents = useCallback(() => {
    saveToHistory(state.calendar.events);
    dispatch({ type: 'CLEAR_EVENTS' });
  }, [saveToHistory, state.calendar.events]);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
    if (error) {
      setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 5000);
    }
  }, []);

  const setSuccess = useCallback((message: string | null) => {
    dispatch({ type: 'SET_SUCCESS', payload: message });
    if (message) {
      setTimeout(() => dispatch({ type: 'SET_SUCCESS', payload: null }), 3000);
    }
  }, []);

  // Undo/Redo functionality
  const undo = useCallback(() => {
    if (past.length === 0) return;
    
    const previousEvents = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    setFuture(prev => [...prev, state.calendar.events]);
    setPast(newPast);
    
    dispatch({
      type: 'SET_CALENDAR',
      payload: {
        ...state.calendar,
        events: previousEvents,
      },
    });
  }, [past, state.calendar]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    
    const nextEvents = future[future.length - 1];
    const newFuture = future.slice(0, -1);
    
    setPast(prev => [...prev, state.calendar.events]);
    setFuture(newFuture);
    
    dispatch({
      type: 'SET_CALENDAR',
      payload: {
        ...state.calendar,
        events: nextEvents,
      },
    });
  }, [future, state.calendar]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const value: CalendarContextType = {
    state,
    addEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
    setCalendar,
    mergeEvents,
    clearEvents,
    createNewEvent,
    setError,
    setSuccess,
    undo,
    redo,
    canUndo,
    canRedo,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextType {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
