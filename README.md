<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="CalGen">
</p>

<h1 align="center">CalGen — Calendar Event Generator</h1>

<p align="center">
  Create, edit, and export calendar events with full ICS support — entirely in your browser.
</p>

<p align="center">
  <a href="https://robyrew.github.io/calendar-event-generator/"><strong>Live Demo</strong></a> ·
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/github/license/RobyRew/calendar-event-generator?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
</p>

---

## Features

**Event Management**
- Create and edit events with an inline editor
- Right-click / long-press context menu (Edit, Duplicate, Export, Delete)
- 10 built-in templates (Meeting, Birthday, Doctor, Workout, Flight, etc.) — localized per language
- Import `.ics` / `.json` files via file picker or drag & drop — import as events or templates
- Multi-select export with checkboxes
- 50-level undo/redo (⌘Z / ⌘⇧Z)
- Unsaved changes detection with discard prompt

**Calendar Views**
- List view with filterable search
- Month view with event indicators
- Week view — 3-day (mobile) / 7-day (desktop)
- Day view with hourly timeline
- Agenda view for upcoming events

**Recurrence (RFC 5545 RRULE)**
- Daily, weekly, monthly, yearly patterns with custom intervals
- Specific weekday selection
- End by date or after N occurrences
- Exception dates (EXDATE)

**Location & Maps**
- Text-based locations with geographic coordinates
- Apple Maps structured location (`X-APPLE-STRUCTURED-LOCATION`)
- MapKit handle preservation on import/export round-trip
- Automatic map links in exports

**Reminders & Attendees**
- Multiple reminders per event (minutes, hours, days before)
- Audio, display, and email alarm types
- Attendee management with roles (Chair, Required, Optional, Non-participant)
- RSVP status tracking and organizer info

**Platform Integration**

| Platform | Extensions |
|----------|-----------|
| Apple Calendar | Structured location, travel time, MapKit handle, creator identity |
| Google Calendar | Conference URL |
| All platforms | Full RFC 5545 iCalendar compliance |

**Interface**
- Three themes: Light, Dark, and OLED
- Three languages: English, Spanish, Romanian
- Responsive design with mobile-first bottom navigation
- Command palette (⌘K) for quick actions
- Keyboard shortcuts (⌘N new, ⌘Z undo, ⌘⇧Z redo, ⌘F search)
- PWA — installable on any device, offline-capable

**Privacy**
- 100% client-side processing — no data leaves your device
- IndexedDB storage for events and templates
- Full backup export/import (JSON)
- Option to strip personal data on export

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 19 |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 4 |
| Build | Vite 6 |
| State | Zustand 5 |
| Database | Dexie (IndexedDB) |
| Dates | date-fns 4 |
| PWA | vite-plugin-pwa |
| Icons | Lucide React |
| Deploy | GitHub Pages |

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone https://github.com/RobyRew/calendar-event-generator.git
cd calendar-event-generator
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

<details>
<summary><strong>Docker</strong></summary>

```bash
docker build -t calgen .
docker run -p 80:80 calgen
```

Uses multi-stage build: `node:20-alpine` → `nginx:alpine`. Production-ready with gzip, caching headers, and SPA routing.

</details>

<details>
<summary><strong>GitHub Pages Deployment</strong></summary>

This project includes a GitHub Actions workflow that builds and deploys to GitHub Pages on every push to `main`.

1. **Fork** or clone this repository
2. Go to **Settings → Pages**
3. Set source to **GitHub Actions**
4. Push to `main` — the site deploys automatically

The workflow sets `BASE_URL=/calendar-event-generator/` for correct asset paths.

</details>

<details>
<summary><strong>Static Hosting</strong></summary>

Run `npm run build` and serve the `dist/` folder with any static hosting provider (Netlify, Vercel, Cloudflare Pages, etc.).

</details>

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `⌘N` | New event |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘F` | Search events |

## Project Structure

```
src/
├── components/
│   ├── calendar/        # Calendar views (month/week/day/agenda)
│   ├── common/          # Command palette
│   ├── event/           # EventCard, EventEditor, EventList, editors
│   ├── import-export/   # Import/export panel with multi-select
│   ├── layout/          # AppShell, Header, Sidebar, MobileNav
│   ├── settings/        # Settings panel
│   ├── templates/       # Template selector
│   └── ui/              # Button, Input, Modal, Toggle, Tabs, etc.
├── hooks/               # useIsMobile, useKeyboard, usePlatform
├── i18n/                # Translations (types + en/es/ro)
├── lib/                 # ICS parser/generator, storage, utils, constants
├── stores/              # Zustand stores (events, settings, UI)
└── types/               # TypeScript types (calendar, settings)
```

## Adding a New Language

<details>
<summary><strong>Step-by-step guide</strong></summary>

1. Copy `src/i18n/locales/en.ts` → `src/i18n/locales/xx.ts` and translate all strings
2. Export it from `src/i18n/locales/index.ts`
3. Add it to the `locales` map in `src/i18n/index.ts`
4. Extend the `Language` type in `src/types/settings.ts`
5. Add the option in `src/components/settings/SettingsPanel.tsx`
6. Optionally localize default templates in `src/lib/default-templates.ts`
7. Run `npm run build` — TypeScript will flag any missing translation keys

</details>

<details>
<summary><strong>Supported language codes (ISO 639-1)</strong></summary>

| Code | Language | Code | Language |
|------|----------|------|----------|
| `ar` | العربية (Arabic) | `ko` | 한국어 (Korean) |
| `de` | Deutsch (German) | `nl` | Nederlands (Dutch) |
| `en` | English | `pl` | Polski (Polish) |
| `es` | Español (Spanish) | `pt` | Português (Portuguese) |
| `fr` | Français (French) | `ro` | Română (Romanian) |
| `it` | Italiano (Italian) | `ru` | Русский (Russian) |
| `ja` | 日本語 (Japanese) | `zh` | 中文 (Chinese) |

For the full list, see [ISO 639-1 on Wikipedia](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).

> **Note:** RTL languages (Arabic, Hebrew, Persian, Urdu) may require additional CSS adjustments.

</details>

## Contributing

Contributions are welcome!

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make changes**, test, and build: `npm run build`
4. **Commit**: `git commit -m "feat: add my feature"`
5. **Push** and open a Pull Request

<details>
<summary><strong>Contribution ideas</strong></summary>

- 🌍 Add a new language translation
- 🎨 Create a new theme
- 📱 Improve mobile UX
- 🧪 Add tests
- 🐛 Fix a bug from the Issues tab

</details>

<details>
<summary><strong>Commit convention</strong></summary>

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `style:` — Code formatting
- `refactor:` — Code refactoring
- `perf:` — Performance improvement
- `chore:` — Maintenance tasks

</details>

## Credits

- [date-fns](https://date-fns.org/) — Date utility library
- [Dexie](https://dexie.org/) — IndexedDB wrapper
- [Lucide](https://lucide.dev/) — Icon toolkit

## License

Licensed under the [Apache License 2.0](LICENSE). You are free to use, modify, and distribute this software — but you **must retain the [NOTICE](NOTICE) file** and give credit to the original project and author in any copies or derivative works.

---

<p align="center">Made with ❤️ by <a href="https://github.com/RobyRew">RobyRew</a></p>
