# 📅 Calendar Event Generator

A modern, feature-rich calendar event generator supporting Apple Calendar, Google Calendar, and Microsoft Outlook. Built with pure TypeScript and Tailwind CSS.

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue?logo=typescript)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 📝 Event Management
- Create and edit calendar events with modern UI
- Import ICS/iCal/IFB files from any source
- Export events as standard ICS files
- Drag & drop file import
- Event templates for quick creation
- Undo/Redo support (⌘Z / ⌘⇧Z)

### 🗓️ Calendar Views
- **List View** - Event list with filtering
- **Calendar View** - Multiple view modes:
  - Month view with event indicators
  - Week view (3-day on mobile, 7-day on desktop)
  - Day view with hourly timeline
  - Agenda view for upcoming events
- Mobile-optimized responsive design

### ⏰ Recurrence (RRULE)
- Daily, weekly, monthly, yearly patterns
- Custom intervals (every N days/weeks/months)
- Specific days of week selection
- End by date or after N occurrences
- Exception dates (EXDATE)

### 📍 Location & Maps
- Text-based locations
- Geographic coordinates (lat/long)
- Apple Maps integration (X-APPLE-STRUCTURED-LOCATION)
- Automatic map links in exports

### 🔔 Reminders
- Multiple reminders per event
- Customizable timing (minutes, hours, days before)
- Audio, display, and email alarm types

### 🔗 Platform Integration

| Platform | Features |
|----------|----------|
| **Apple Calendar** | Structured location, travel time, creator identity |
| **Google Calendar** | Direct "Add to Calendar" URL links |
| **Microsoft Outlook** | Busy status, importance, all-day flags |
| **Yahoo Calendar** | Quick-add URL support |

### 🎨 Themes
4 carefully crafted themes:
- **Light** - Clean, bright interface
- **Dark** - Grayscale dark mode
- **OLED** - Pure black for AMOLED displays
- **Neumorphic** - Soft UI with depth

### 🌍 Languages
Full translations in:
- 🇬🇧 English
- 🇪🇸 Español
- 🇩🇪 Deutsch
- 🇫🇷 Français

### 💾 Data Persistence
- Automatic localStorage save
- Events persist across sessions
- Settings (theme, language) remembered
- Clear data option in settings

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `⌘K` | Open command palette |
| `⌘N` | New event |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type-safe application code |
| **Tailwind CSS** | Styling with CSS variables |
| **Vite** | Build tool & dev server |
| **Lucide React** | Icon library |
| **date-fns** | Date manipulation |

> **Note on Languages**: GitHub shows ~1.3% JavaScript because config files (ESLint, PostCSS, Tailwind) and the service worker require JavaScript by design. All application code is 100% TypeScript.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (see `.nvmrc`)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/RobyRew/calendar-event-generator.git
cd calendar-event-generator

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker

```bash
# Build image
docker build -t calendar-event-generator .

# Run container
docker run -p 80:80 calendar-event-generator
```

## 📁 Project Structure

```
src/
├── components/              # React components
│   ├── ui/                  # Reusable UI (Card, Button, Input, Alert)
│   ├── CalendarView.tsx     # Calendar grid with multiple views
│   ├── CommandPalette.tsx   # Quick actions (⌘K)
│   ├── EventForm.tsx        # Event creation form
│   ├── EventFormAccordion.tsx # Accordion-style form
│   ├── EventList.tsx        # Event list display
│   ├── ExportOptions.tsx    # Export modal
│   ├── Footer.tsx           # App footer with credits
│   ├── Header.tsx           # App header with settings
│   ├── NewEventModal.tsx    # New event modal with templates
│   └── Settings.tsx         # Settings panel (theme, language, data)
├── context/                 # React contexts
│   ├── CalendarContext.tsx  # Global state with undo/redo
│   └── I18nContext.tsx      # Internationalization
├── i18n/                    # Translations
│   ├── translations.ts      # Type definitions
│   └── locales/             # Language files (en, es, de, fr)
├── lib/                     # Core utilities
│   ├── ics-generator.ts     # ICS file generation
│   ├── ics-parser.ts        # ICS file parsing
│   ├── storage.ts           # localStorage persistence
│   └── utils.ts             # Helper functions
├── styles/                  # Theme system
│   ├── themes.css           # CSS variable definitions
│   └── themes/              # Theme configurations
├── types/                   # TypeScript types
│   └── calendar.types.ts    # Event & calendar types
├── App.tsx                  # Main application
├── main.tsx                 # Entry point
└── index.css                # Global styles & Tailwind
```

## 📋 ICS Format Support

Full RFC 5545 (iCalendar) compliance:

- `VCALENDAR` container with PRODID, VERSION
- `VEVENT` with all standard properties
- `VTIMEZONE` with DAYLIGHT/STANDARD
- `VALARM` for reminders (AUDIO, DISPLAY, EMAIL)
- `RRULE` for recurrence patterns
- `EXDATE` for exceptions
- Platform-specific `X-` extensions

## 🎯 Usage

### Creating an Event
1. Click **+ New Event** or press `⌘N`
2. Choose a template or start blank
3. Fill in event details
4. Click **Save Event**

### Importing Events
- Drag & drop `.ics` files onto the app
- Or click **Import** and select files

### Exporting Events
1. Click **Export** in the toolbar
2. Choose format (ICS, JSON, Markdown, CSV)
3. Export all events or selected only

### Settings
Click the ⚙️ icon in the header to:
- Change theme (Light/Dark/OLED/Neumorphic)
- Change language (EN/ES/DE/FR)
- Clear all stored data

## � Roadmap

Planned features for future releases:

### High Priority
- [ ] **Cloud Sync** - Sync events across devices (Google Drive, iCloud, Dropbox)
- [ ] **CalDAV Support** - Connect to calendar servers (Nextcloud, Fastmail, etc.)
- [ ] **PWA Offline** - Full offline support with background sync
- [ ] **Push Notifications** - Browser notifications for reminders

### Medium Priority
- [ ] **Attendees Management** - Invite people, RSVP tracking
- [ ] **Conference Links** - Zoom, Google Meet, Teams integration
- [ ] **Event Search** - Full-text search across all events
- [ ] **Bulk Operations** - Select and edit/delete multiple events
- [ ] **Event Sharing** - Share via link, QR code, or social media
- [ ] **Calendar Subscriptions** - Subscribe to external .ics feeds

### Nice to Have
- [ ] **Natural Language Input** - "Meeting tomorrow at 3pm"
- [ ] **AI Event Suggestions** - Smart scheduling based on patterns
- [ ] **Widget Support** - Home screen widgets (when PWA supports it)
- [ ] **More Languages** - Italian, Portuguese, Chinese, Japanese
- [ ] **Event Analytics** - Time spent in meetings, busy hours chart
- [ ] **Custom Templates** - Save your own event templates
- [ ] **Color Coding** - Custom colors per event/category
- [ ] **Conflict Detection** - Warn about overlapping events

### Integrations
- [ ] **Notion** - Sync with Notion databases
- [ ] **Todoist/Ticktick** - Import tasks as events
- [ ] **Slack** - Post event reminders to channels
- [ ] **Webhooks** - Custom integrations via webhooks

## �📄 License

MIT License - feel free to use for any purpose.

## 🤝 Contributing

Contributions welcome! Please submit a Pull Request.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/RobyRew">RobyRew</a>
</p>
