/**
 * Search and Filter Component
 * Advanced filtering for events
 */

import { useState, useMemo } from 'react';
import { CalendarEvent } from '@/types';
import { Button } from '@/components/ui';
import { Search, Filter, X, Calendar, Tag, MapPin } from 'lucide-react';
import { isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

interface SearchFilterProps {
  events: CalendarEvent[];
  onFilteredEventsChange: (events: CalendarEvent[]) => void;
}

interface FilterState {
  query: string;
  dateFrom: string;
  dateTo: string;
  categories: string[];
  status: string[];
  hasLocation: boolean | null;
  sourceFile: string;
}

const initialFilters: FilterState = {
  query: '',
  dateFrom: '',
  dateTo: '',
  categories: [],
  status: [],
  hasLocation: null,
  sourceFile: '',
};

export function SearchFilter({ events, onFilteredEventsChange }: SearchFilterProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const statuses = new Set<string>();
    const sourceFiles = new Set<string>();

    events.forEach(event => {
      event.categories?.forEach(cat => categories.add(cat));
      statuses.add(event.status);
      if (event.sourceFile) sourceFiles.add(event.sourceFile);
    });

    return {
      categories: Array.from(categories).sort(),
      statuses: Array.from(statuses),
      sourceFiles: Array.from(sourceFiles).sort(),
    };
  }, [events]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Text search
    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      result = result.filter(event => 
        event.summary.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location?.text?.toLowerCase().includes(query) ||
        event.categories?.some(cat => cat.toLowerCase().includes(query))
      );
    }

    // Date range
    if (filters.dateFrom) {
      const fromDate = startOfDay(new Date(filters.dateFrom));
      result = result.filter(event => isAfter(event.startDate, fromDate) || event.startDate.getTime() === fromDate.getTime());
    }
    if (filters.dateTo) {
      const toDate = endOfDay(new Date(filters.dateTo));
      result = result.filter(event => isBefore(event.startDate, toDate) || event.startDate.getTime() === toDate.getTime());
    }

    // Categories
    if (filters.categories.length > 0) {
      result = result.filter(event => 
        filters.categories.some(cat => event.categories?.includes(cat))
      );
    }

    // Status
    if (filters.status.length > 0) {
      result = result.filter(event => filters.status.includes(event.status));
    }

    // Has location
    if (filters.hasLocation !== null) {
      result = result.filter(event => 
        filters.hasLocation ? Boolean(event.location?.text) : !event.location?.text
      );
    }

    // Source file
    if (filters.sourceFile) {
      result = result.filter(event => event.sourceFile === filters.sourceFile);
    }

    return result;
  }, [events, filters]);

  // Update parent when filtered events change
  useMemo(() => {
    onFilteredEventsChange(filteredEvents);
  }, [filteredEvents, onFilteredEventsChange]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const toggleStatus = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const clearFilters = () => {
    setFilters(initialFilters);
  };

  const hasActiveFilters = 
    filters.query ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.categories.length > 0 ||
    filters.status.length > 0 ||
    filters.hasLocation !== null ||
    filters.sourceFile;

  const activeFilterCount = [
    filters.query,
    filters.dateFrom,
    filters.dateTo,
    filters.categories.length > 0,
    filters.status.length > 0,
    filters.hasLocation !== null,
    filters.sourceFile,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Main Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filters.query}
            onChange={e => updateFilter('query', e.target.value)}
            placeholder="Search events..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 
                       bg-white dark:bg-slate-800 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       placeholder:text-gray-400"
          />
          {filters.query && (
            <button
              onClick={() => updateFilter('query', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <Button
          variant={showAdvanced ? 'primary' : 'secondary'}
          size="md"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="relative"
        >
          <Filter className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-slate-400">
        <span>
          {filteredEvents.length} of {events.length} events
          {hasActiveFilters && ' (filtered)'}
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg space-y-4 animate-fade-in">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => updateFilter('dateFrom', e.target.value)}
                className="flex-1 px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 
                           bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => updateFilter('dateTo', e.target.value)}
                className="flex-1 px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 
                           bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Categories */}
          {filterOptions.categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {filterOptions.categories.map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`
                      px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                      ${filters.categories.includes(category)
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                      }
                    `}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.statuses.map(status => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                    ${filters.status.includes(status)
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Has Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </label>
            <div className="flex gap-2">
              {[
                { value: null, label: 'Any' },
                { value: true, label: 'With location' },
                { value: false, label: 'No location' },
              ].map(option => (
                <button
                  key={String(option.value)}
                  onClick={() => updateFilter('hasLocation', option.value)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                    ${filters.hasLocation === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source File */}
          {filterOptions.sourceFiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Source File
              </label>
              <select
                value={filters.sourceFile}
                onChange={e => updateFilter('sourceFile', e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 
                           bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All files</option>
                {filterOptions.sourceFiles.map(file => (
                  <option key={file} value={file}>{file}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
