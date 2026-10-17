<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="CalGen">
</p>

<h1 align="center">CalGen — Calendar Event Generator</h1>

<p align="center">
  Create, edit, and export calendar events with full ICS support — on your device, or in an account calendar you can share as a live subscription.
</p>

<p align="center">
  <a href="https://calendar.robyrew.com/"><strong>App</strong></a> ·
  <a href="https://robyrew.github.io/calendar-event-generator/">Local-only demo</a> ·
  <a href="#features">Features</a> ·
  <a href="#sharing-live-calendars">Sharing</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0-blue?style=flat-square" alt="Version">
  <img src="https://img.shields.io/github/license/RobyRew/calendar-event-generator?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/Astro-7-BC52EE?style=flat-square&logo=astro&logoColor=white" alt="Astro">
  <img src="https://img.shields.io/badge/TypeScript-6-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19_island-blue?style=flat-square&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
</p>

---

## Features

**Event Management**
- Create and edit events with an inline editor
- Right-click / long-press context menu (Edit, Duplicate, Export, Share live link, Delete)
- 10 built-in templates (Meeting, Birthday, Doctor, Workout, Flight, etc.) — localized per language
- Import `.ics` / `.json` files via file picker or drag & drop (several at once) — import as events or templates
- Multi-select export with checkboxes
- 50-level undo/redo (⌘Z / ⌘⇧Z)
- Unsaved changes detection with discard prompt

**Calendar Views**
- List view with filterable search
- Month view with event indicators
- Week view — 3-day (mobile) / 7-day (desktop)
- Day view with hourly timeline
- Agenda view for upcoming events

**Time zones**
- Each event has its own IANA time zone; dates and times are entered as wall-clock time in that zone
- Exports carry `TZID` with the matching `VTIMEZONE` from the IANA tz database
- All-day events export as dates with an exclusive end (RFC 5545)

**Recurrence (RFC 5545 RRULE)**
- Daily, weekly, monthly, yearly patterns with custom intervals
- Specific weekday selection
- End by date or after N occurrences
- Exception dates (EXDATE) and moved occurrences (RECURRENCE-ID)

**Location & Maps**
- Text-based locations with geographic coordinates
- Apple Maps structured location (`X-APPLE-STRUCTURED-LOCATION`)
- MapKit handle preservation on import/export round-trip

**Reminders & Attendees**
- Multiple reminders per event (minutes, hours, days, weeks before)
- Audio, display, and email alarm types
- Attendee management with roles (Chair, Required, Optional, Non-participant)
- RSVP status tracking and organizer info

**Accounts and sharing** (calendar.robyrew.com)
- Sign in with the RobyRew account (Logto: email, passkeys, Google, Microsoft, Apple…)
- Account calendars next to the events on this device, each with its own show/hide switch
- Live share links for a whole calendar or a single event, in four levels — see [Sharing](#sharing-live-calendars)
- Collaborators join through an editor invite and edit events with you

**Interface**
- Three themes: Light, Dark, and OLED
- Three languages: English, Spanish, Romanian
- Responsive design with mobile-first bottom navigation
- Command palette (⌘K) for quick actions
- Keyboard shortcuts (⌘N new, ⌘Z undo, ⌘⇧Z redo, ⌘F search)
- PWA — installable on any device, offline-capable

**Privacy**
- Without signing in, everything stays in this browser (IndexedDB); nothing is sent anywhere
- Events you put in an account calendar are stored on the server so they can be shared; events on this device are only uploaded when you choose "Copy to account"
- Full backup export/import (JSON)
- Option to strip personal data (organizer, attendees, contact) on export

## Sharing live calendars

A share link opens a page with **Apple Calendar**, **Google Calendar**, **Outlook.com** and **Microsoft 365** subscribe buttons, a copyable feed URL and a QR code. Subscribers' calendar apps fetch the feed on their own schedule, so later edits appear for them without anything being re-sent.

| Level | Subscribers see |
|---|---|
| Free/busy only | Blocks marked "Busy" — no titles, places, notes or people; free and cancelled events left out |
| Titles and times | Titles, times, recurrence; no notes, places or people |
| Full details | Everything except the sharer's reminders |
| Editor invite | Not a feed: whoever opens it signs in and becomes an editor (and gets a personal full-detail feed) |

Links can be named, given an expiry, revoked, or given a new URL. Google Calendar adds subscriptions from the desktop web and refreshes them every few hours; Apple refreshes at the interval chosen in its settings. Details: [docs/sharing.md](docs/sharing.md).

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Astro 7 (Node adapter), React 19 as one `client:only` island |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 4, [`@robyrew/web-config`](https://github.com/RobyRew/web-config) / `@robyrew/ui` |
| Device storage | Dexie (IndexedDB), Zustand |
| Server storage | SQLite (better-sqlite3) via Drizzle |
| Accounts | Logto (auth.robyrew.com), Traditional Web flow in `src/server/logto/` |
| Dates | date-fns 4, `@date-fns/tz`, `timezones-ical-library` |
| Tests | Vitest, with ical.js as an independent parser |
| PWA | workbox-build |
| Deploy | Docker on Dokploy (calendar.robyrew.com); static build on GitHub Pages |

## Development

### Prerequisites

- Node.js 22.22+
- npm

### Setup

```bash
git clone https://github.com/RobyRew/calendar-event-generator.git
cd calendar-event-generator
npm install
npm run db:migrate   # creates ./data/calendar.db
npm run dev          # http://localhost:5173
```

Without `LOGTO_*` the app runs with accounts shown as unavailable; everything on this device works. To sign in locally, register a Logto app as described in [docs/auth-logto.md](docs/auth-logto.md) and set:

| Variable | Example | Notes |
|---|---|---|
| `LOGTO_ENDPOINT` | `https://auth.robyrew.com` | |
| `LOGTO_APP_ID` | from the Logto console | Traditional Web app, first-party |
| `LOGTO_APP_SECRET` | from the Logto console | server only, never in the bundle |
| `PUBLIC_SITE_URL` | `http://localhost:5173` | public origin; redirect URIs and feed URLs are built from it |
| `DB_URL` | `file:./data/calendar.db` | SQLite file |

### Checks

```bash
npm run typecheck      # astro check + tsc
npm test               # Vitest, run under TZ=UTC, America/New_York and Europe/Bucharest
npm run build          # server build (dist/client + dist/server)
npm run build:static   # local-only build (dist/), as published to GitHub Pages
```

<details>
<summary><strong>Docker</strong></summary>

```bash
docker build -t calgen .
docker run -p 4321:4321 -v "$PWD/data:/app/data" \
  -e PUBLIC_SITE_URL=http://localhost:4321 calgen
```

Multi-stage build: `node:22-alpine` builds, then a non-root `node:22-alpine` runtime (uid 100, gid 101) serves on **4321**. On a Linux host, the mounted `data` directory must be writable by that uid (`sudo chown 100:101 data`). On start it applies migrations (`scripts/migrate.mjs`) and runs `server.mjs`, which adds the shared security headers to every response. `GET /api/health` is the health check. Mount `/app/data`, or the database is lost with the container.

</details>

<details>
<summary><strong>Production (Dokploy)</strong></summary>

`build-image.yml` builds `ghcr.io/robyrew/calendar-event-generator` on every push to `main` and triggers the Dokploy deploy. In Dokploy:

- Domain `calendar.robyrew.com` → port **4321**
- Environment: `LOGTO_ENDPOINT`, `LOGTO_APP_ID`, `LOGTO_APP_SECRET`, `PUBLIC_SITE_URL=https://calendar.robyrew.com`
- Advanced → Volumes → **Volume Mount** (a named volume): name `calendar-event-generator-data`, mount path `/app/data`. Docker creates the volume on the first deploy and seeds it from the image's `/app/data`, which is owned by the container's uid 100 / gid 101, so no host directory or `chown` is involved. The volume survives redeploys; the infrastructure repo backs it up through `backup_docker_volumes`. Without it, the database lives in the container and each deploy starts with an empty one.
- Memory limit 256 MB

</details>

<details>
<summary><strong>GitHub Pages (local-only build)</strong></summary>

`deploy.yml` publishes `npm run build:static` with `BASE_URL=/calendar-event-generator/` on every push to `main`. That build has no server routes and no account or sharing controls; everything stays in the browser.

</details>

## Analytics (optional)

Self-hosted Umami is configured at build time in `.env.production` (`PUBLIC_UMAMI_SCRIPT_URL`, `PUBLIC_UMAMI_WEBSITE_ID`, `PUBLIC_UMAMI_DOMAINS`). These are public identifiers baked into the page. `data-domains` keeps forks and previews from reporting, and `data-do-not-track` honours the browser's DNT setting. Without the values, no analytics tag is rendered.

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
├── pages/index.astro    # the app shell; mounts <App client:only="react" />
├── layouts/             # Base.astro (<head>, analytics, service worker)
├── App.tsx              # React island root
├── components/          # React UI (calendar views, editor, account, share dialog…)
├── lib/                 # ICS generator/parser, time model, redaction, storage (pure, shared with the server)
├── stores/              # Zustand stores (events, account, settings, UI)
├── i18n/                # Translations (types + en/es/ro)
├── server/              # Server-only: DB schema/client, auth, authz, repo, feeds
└── server-routes/       # API, /feed/<token>.ics, /s/<token> (server build only)
integrations/            # Astro integrations: server routes, service worker
drizzle/                 # SQL migrations
server.mjs               # production entry (security headers)
tests/                   # server tests (authz matrix, feeds)
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
