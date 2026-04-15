# 📅 CalGen — Calendar Event Generator

> The most complete open-source calendar event generator for Apple Calendar, Google Calendar, Outlook, and more. Built as a fast, offline-capable PWA.

![React](https://img.shields.io/badge/React-19.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2-38B2AC?logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-Apache_2.0-blue)

### 🔗 [Live Demo → robyryw.github.io/calendar-event-generator](https://robyrew.github.io/calendar-event-generator/)

## ⭐ Star this repo if you find it useful!

---

## ✨ Features

<details>
<summary><strong>📝 Event Management</strong></summary>

- Create and edit events with an inline editor that opens right in the event list
- Right-click / long-press context menu on event cards (Edit, Duplicate, Export, Delete)
- 10 built-in templates (Meeting, Birthday, Doctor, Workout, Flight, etc.) — localized per language
- Import `.ics` / `.json` files via file picker or drag & drop — choose to import as events or templates
- Multi-select export with checkboxes
- 50-level undo/redo (⌘Z / ⌘⇧Z)
- Unsaved changes detection with discard prompt

</details>

<details>
<summary><strong>🗓️ Calendar Views</strong></summary>

- **List View** — Filterable event list with search
- **Month View** — Grid with event indicators
- **Week View** — 3-day (mobile) / 7-day (desktop) with time slots
- **Day View** — Hourly timeline
- **Agenda View** — Upcoming events

</details>

<details>
<summary><strong>⏰ Recurrence (RFC 5545 RRULE)</strong></summary>

- Daily, weekly, monthly, yearly patterns
- Custom intervals (every N days/weeks/months)
- Specific weekday selection
- End by date or after N occurrences
- Exception dates (EXDATE)

</details>

<details>
<summary><strong>📍 Location & Maps</strong></summary>

- Text-based locations
- Geographic coordinates (latitude/longitude)
- Apple Maps structured location (`X-APPLE-STRUCTURED-LOCATION`)
- MapKit handle preservation on import/export round-trip
- Automatic map links in exports

</details>

<details>
<summary><strong>🔔 Reminders & Attendees</strong></summary>

- Multiple reminders per event (minutes, hours, days before)
- Audio, display, and email alarm types
- Attendee management with roles (Chair, Required, Optional, Non-participant)
- RSVP status tracking
- Organizer info

</details>

<details>
<summary><strong>🔗 Platform Integration</strong></summary>

| Platform | Extensions |
|----------|-----------|
| **Apple Calendar** | Structured location, travel time, MapKit handle, creator identity |
| **Google Calendar** | Conference URL |
| **All platforms** | Full RFC 5545 iCalendar compliance |

</details>

<details>
<summary><strong>🎨 Themes & Languages</strong></summary>

**3 themes:**
- ☀️ Light — Clean, bright interface
- 🌙 Dark — Comfortable dark mode
- 🖤 OLED — Pure black for AMOLED displays

**3 languages:**
- 🇬🇧 English
- 🇪🇸 Español
- 🇷🇴 Română

Auto-detection of system theme preference.

</details>

<details>
<summary><strong>📱 Mobile-First PWA</strong></summary>

- Installable as a standalone app on iOS/Android/Desktop
- Offline-capable with service worker
- Dynamic viewport height (`dvh`) for proper mobile Safari handling
- Safe area insets for notched devices
- Touch-optimized: long-press for context menus
- Responsive layout: mobile navigation bar + desktop sidebar

</details>

<details>
<summary><strong>💾 Data & Storage</strong></summary>

- IndexedDB via Dexie for events and templates
- localStorage for user settings
- Full backup export/import (JSON)
- Privacy: strip personal data on export option
- All data stays local — no server, no tracking

</details>

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [React](https://react.dev) | 19.1 | UI framework |
| [TypeScript](https://typescriptlang.org) | 5.8 | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4.2 | Styling (CSS-first config) |
| [Vite](https://vite.dev) | 6.4 | Build tool & dev server |
| [Zustand](https://zustand.docs.pmnd.rs) | 5.0 | State management |
| [Dexie](https://dexie.org) | 4.0 | IndexedDB wrapper |
| [date-fns](https://date-fns.org) | 4.1 | Date utilities |
| [Lucide React](https://lucide.dev) | 0.475 | Icons |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | 1.2 | PWA/Service Worker |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** 9+

### Local Development

```bash
git clone https://github.com/RobyRew/calendar-event-generator.git
cd calendar-event-generator
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview   # Preview at http://localhost:4173
```

<details>
<summary><strong>🐳 Docker</strong></summary>

```bash
docker build -t calgen .
docker run -p 80:80 calgen
```

Uses multi-stage build: `node:20-alpine` → `nginx:alpine`. Production-ready with gzip, caching headers, and SPA routing.

</details>

<details>
<summary><strong>🌐 GitHub Pages Deployment</strong></summary>

1. **Fork** this repository
2. Go to **Settings → Pages**
3. Set source to **GitHub Actions**
4. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          BASE_URL: /calendar-event-generator/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

5. Update `vite.config.ts` to set the base path:

```ts
export default defineConfig({
  base: '/calendar-event-generator/',
  // ...rest of config
})
```

6. Push to `main` — the site deploys automatically.

</details>

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `⌘N` | New event |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘F` | Search events |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── calendar/        # Calendar view (month/week/day/agenda)
│   ├── common/          # Command palette, shared components
│   ├── event/           # EventCard, EventEditor, EventList, editors
│   ├── import-export/   # Import/export panel with multi-select
│   ├── layout/          # AppShell, Header, Sidebar, MobileNav
│   ├── settings/        # Settings panel
│   ├── templates/       # Template selector
│   └── ui/              # Button, Input, Modal, Toggle, Tabs, etc.
├── hooks/               # useIsMobile, useKeyboard
├── i18n/                # Translations (types + en/es/ro)
├── lib/                 # ICS parser/generator, storage, utils, constants
├── stores/              # Zustand stores (events, settings, UI)
└── types/               # TypeScript types (calendar, settings, templates)
```

---

## 🌍 Adding a New Language

CalGen supports all standard [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) languages. Follow these steps to add a translation:

<details>
<summary><strong>Step-by-step guide</strong></summary>

### 1. Create the locale file

Copy `src/i18n/locales/en.ts` and rename it to your language code (e.g., `fr.ts` for French):

```bash
cp src/i18n/locales/en.ts src/i18n/locales/fr.ts
```

Translate every string value in the file. The `Translations` interface in `src/i18n/types.ts` defines all ~300 keys — your file must export every one of them.

```ts
// src/i18n/locales/fr.ts
import type { Translations } from '../types'

export const fr: Translations = {
  appName: 'Générateur d\'Événements',
  events: 'Événements',
  // ... translate all keys
}
```

### 2. Register the locale

**`src/i18n/locales/index.ts`** — Add the export:

```ts
export { en } from './en'
export { es } from './es'
export { ro } from './ro'
export { fr } from './fr'   // ← add
```

**`src/i18n/index.ts`** — Add it to the `locales` map:

```ts
import { en, es, ro, fr } from './locales'

const locales: Record<Language, Translations> = { en, es, ro, fr }
```

### 3. Add the Language type

**`src/types/settings.ts`** — Extend the union:

```ts
export type Language = 'en' | 'es' | 'ro' | 'fr'
```

### 4. Add the option in Settings

**`src/components/settings/SettingsPanel.tsx`** — Add to the language select options:

```ts
{ value: 'fr', label: 'Français' },
```

### 5. Localize default templates (optional but recommended)

**`src/lib/default-templates.ts`** — Add entries for your language in the `TEMPLATE_I18N` map:

```ts
'meeting': {
  en: { name: 'Meeting', ... },
  es: { name: 'Reunión', ... },
  ro: { name: 'Întâlnire', ... },
  fr: { name: 'Réunion', description: '...', summary: '...' },  // ← add
},
```

### 6. Build and test

```bash
npm run build
```

Make sure all keys are present — TypeScript will flag any missing translations at compile time.

</details>

<details>
<summary><strong>Accepted languages (ISO 639-1)</strong></summary>

Only standard ISO 639-1 language codes are accepted. Some common examples:

| Code | Language | Code | Language |
|------|----------|------|----------|
| `ar` | العربية (Arabic) | `ko` | 한국어 (Korean) |
| `bg` | Български (Bulgarian) | `ms` | Bahasa Melayu (Malay) |
| `bn` | বাংলা (Bengali) | `nl` | Nederlands (Dutch) |
| `ca` | Català (Catalan) | `no` | Norsk (Norwegian) |
| `cs` | Čeština (Czech) | `pl` | Polski (Polish) |
| `da` | Dansk (Danish) | `pt` | Português (Portuguese) |
| `de` | Deutsch (German) | `ro` | Română (Romanian) |
| `el` | Ελληνικά (Greek) | `ru` | Русский (Russian) |
| `en` | English | `sk` | Slovenčina (Slovak) |
| `es` | Español (Spanish) | `sl` | Slovenščina (Slovenian) |
| `et` | Eesti (Estonian) | `sr` | Српски (Serbian) |
| `fa` | فارسی (Persian) | `sv` | Svenska (Swedish) |
| `fi` | Suomi (Finnish) | `sw` | Kiswahili (Swahili) |
| `fr` | Français (French) | `ta` | தமிழ் (Tamil) |
| `he` | עברית (Hebrew) | `th` | ไทย (Thai) |
| `hi` | हिन्दी (Hindi) | `tr` | Türkçe (Turkish) |
| `hr` | Hrvatski (Croatian) | `uk` | Українська (Ukrainian) |
| `hu` | Magyar (Hungarian) | `ur` | اردو (Urdu) |
| `id` | Bahasa Indonesia | `vi` | Tiếng Việt (Vietnamese) |
| `it` | Italiano (Italian) | `zh` | 中文 (Chinese) |
| `ja` | 日本語 (Japanese) | | |

For the full list, see [ISO 639-1 on Wikipedia](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).

> **Note:** RTL languages (Arabic, Hebrew, Persian, Urdu) are accepted but may require additional CSS adjustments for proper right-to-left layout.

</details>

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/calendar-event-generator.git`
3. **Create a branch**: `git checkout -b feature/my-feature`
4. **Install deps**: `npm install`
5. **Run dev server**: `npm run dev`
6. **Make your changes** and test them
7. **Build** to verify: `npm run build`
8. **Commit**: `git commit -m "feat: add my feature"`
9. **Push**: `git push origin feature/my-feature`
10. **Open a Pull Request**

<details>
<summary><strong>Contribution ideas</strong></summary>

- 🌍 Add a new language translation (add a file in `src/i18n/locales/`)
- 🎨 Create a new theme (add CSS variables in `src/index.css`)
- 📱 Improve mobile UX
- 🧪 Add tests
- 📖 Improve documentation
- 🐛 Fix a bug from the Issues tab

</details>

<details>
<summary><strong>Commit convention</strong></summary>

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `style:` — Code formatting (not CSS)
- `refactor:` — Code refactoring
- `perf:` — Performance improvement
- `chore:` — Maintenance tasks

</details>

---

## 📄 License

Licensed under the [Apache License 2.0](LICENSE). You are free to use, modify, and distribute this software — but you **must retain the [NOTICE](NOTICE) file** and give credit to the original project and author in any copies or derivative works.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/RobyRew">RobyRew</a>
</p>
