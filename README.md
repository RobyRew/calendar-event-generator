# Calendar Event Generator

A comprehensive calendar event generator that supports all features of Apple Calendar, Google Calendar, and Microsoft Outlook. Create, import, and export ICS/iCal files with full support for platform-specific extensions.

## Features

### Core Features
- ✅ Create and edit calendar events with a modern UI
- ✅ Import ICS/iCal/IFB files from any source
- ✅ Export events as standard ICS files
- ✅ Full timezone support with common presets
- ✅ All-day events
- ✅ Multiple reminders/alarms per event
- ✅ Event categories and tags
- ✅ Event priority settings

### Recurrence (RRULE)
- ✅ Daily, weekly, monthly, and yearly recurrence
- ✅ Custom intervals (every N days/weeks/months/years)
- ✅ Specific days of week for weekly recurrence
- ✅ End after N occurrences or by date
- ✅ Exception dates (EXDATE)

### Location & Maps
- ✅ Text-based locations
- ✅ Geographic coordinates (latitude/longitude)
- ✅ Apple Maps integration (X-APPLE-STRUCTURED-LOCATION)
- ✅ Automatic map links in exported events

### Platform Extensions

#### Apple Calendar
- X-APPLE-STRUCTURED-LOCATION for rich map data
- X-APPLE-TRAVEL-ADVISORY-BEHAVIOR for travel time
- X-APPLE-CREATOR-IDENTITY

#### Microsoft Outlook
- X-MICROSOFT-CDO-BUSYSTATUS (Free/Tentative/Busy/OOF)
- X-MICROSOFT-CDO-IMPORTANCE (Low/Normal/High)
- X-MICROSOFT-CDO-ALLDAYEVENT

#### Google Calendar
- Direct "Add to Google Calendar" links
- Conference data support (future)

### Quick Add Links
- Google Calendar URL
- Outlook.com Calendar URL
- Office 365 Calendar URL
- Yahoo Calendar URL

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Lucide React** - Icons
- **date-fns** - Date manipulation

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   ├── EventForm.tsx    # Event creation/editing form
│   ├── EventList.tsx    # Event list display
│   ├── ImportExportPanel.tsx  # Import/export functionality
│   └── Header.tsx       # App header
├── context/             # React context providers
│   └── CalendarContext.tsx   # Global state management
├── lib/                 # Core libraries
│   ├── ics-parser.ts    # ICS file parser
│   └── ics-generator.ts # ICS file generator
├── types/               # TypeScript types
│   └── calendar.types.ts # Calendar event types
├── App.tsx              # Main application
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## ICS Format Support

The generator fully supports the iCalendar specification (RFC 5545) including:

- VCALENDAR container
- VEVENT components
- VTIMEZONE with DAYLIGHT/STANDARD
- VALARM (reminders)
- RRULE (recurrence)
- EXDATE (exceptions)
- All standard properties (SUMMARY, DESCRIPTION, LOCATION, etc.)
- Platform-specific X- properties

## Usage Examples

### Creating an Event

1. Click "New Event"
2. Fill in the event details across the tabs:
   - **Basic**: Title, description, URL, categories
   - **Date & Time**: Start/end, timezone, all-day option
   - **Location**: Address, coordinates
   - **Repeat**: Recurrence rules
   - **Reminders**: Multiple alerts
   - **Advanced**: Status, visibility, organizer, platform extensions
3. Click "Save Event"

### Importing an ICS File

1. Click "Import ICS File" in the right panel
2. Select an .ics, .ical, or .ifb file
3. Events will be parsed and added to the list

### Exporting Events

1. Use "Export All Events" to download all events as one ICS file
2. Use "Export Selected Event" for a single event
3. Use "Preview ICS" to see the raw ICS content

### Quick Add to Calendar

Select an event to see quick-add links for:
- Google Calendar
- Outlook.com
- Office 365
- Yahoo Calendar
- Apple Calendar (via ICS download)

## License

MIT License - feel free to use this project for any purpose.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
