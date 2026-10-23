# Sharing — live calendar feeds

## What a share link is

A share link points at an account calendar, or at one event in it (by UID, so a recurring event's moved occurrences come along). Its token (32 random bytes, base64url) is the credential. Calendar apps fetch feeds from their own servers without cookies, so the unguessable URL is what grants access.

| URL | Purpose |
|---|---|
| `/s/<token>` | Share page: what is shared, by whom, at which level, a preview at that level, subscribe buttons, QR code |
| `/feed/<token>.ics` | The feed (`text/calendar`); `?download=1` serves it as a one-time download |

## Levels

| Level | In the feed |
|---|---|
| `busy` | `SUMMARY:Busy`, times, recurrence, `CLASS:PRIVATE`; description, location, attendees, organizer, URL, categories and colour removed; free (`TRANSP:TRANSPARENT`) and cancelled events left out; a left-out occurrence becomes an `EXDATE` on its series, a cancelled series takes its changed occurrences along, and an occurrence marked busy in a free series stays in |
| `limited` | summary, times, recurrence, status; description, location, attendees, organizer, URL and conference link removed |
| `full` | all event fields |
| `edit` | not a feed (404). Opening the share page asks for a sign-in. Joining makes the user an editor and creates a personal `full` link for them, which is removed again when they leave or are removed. |

Every level leaves out VALARMs (subscribers set their own alerts). The fields come from `redactEvent()` in `src/lib/redact.ts`, the same function the "Strip personal data" export option uses.

## Feed format

- `METHOD:PUBLISH`, `NAME` / `X-WR-CALNAME` (the link's name, the calendar or event name, or "Busy" for busy links), `X-WR-TIMEZONE`, `COLOR` + `X-APPLE-CALENDAR-COLOR`, `REFRESH-INTERVAL;VALUE=DURATION:PT1H` + `X-PUBLISHED-TTL:PT1H`, `SOURCE`
- Stable UIDs; `SEQUENCE` goes up on every server-side change (also on undo)
- `ETag` (content hash) and `Last-Modified`; a matching `If-None-Match` gets `304`. `If-Modified-Since` alone is answered in full, since a timestamp does not capture every change
- One `VTIMEZONE` per zone used. The bundled block (timezones-ical-library) is used when it gives the server's tz offsets at every date the feed needs; otherwise one is built from the server's tz data for those years, continued with yearly rules where the zone follows one
- Unknown, revoked, expired and invite tokens all answer `404`
- Rate limits: 120 requests/min per IP, 60/min per token; share pages 60/min per IP
- Rendered feeds are cached in memory per link (newest version only, 64 MB in total; bodies over 16 MB are not cached), and share-page previews per link for up to an hour
- `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` on feeds and share pages

## Limits

Feeds and share pages load a whole calendar per request, so its size is bounded:

| What | Limit | Error |
|---|---|---|
| Events (rows) in a calendar | 10,000 | `413 calendar_full` |
| Stored event data in a calendar | 16 MiB of JSON | `413 calendar_full` |
| One stored event | 64 KiB of JSON | `413 event_too_large` |
| One recurring event: changed occurrences | 500 | `413 too_many_overrides` |
| One recurring event: master plus changed occurrences | 2 MiB of JSON | `413 event_too_large` |
| Import request | 5,000 events, 8 MiB body | `400` / `413 too_large` |
| Calendars a user owns (subscriptions included) | 50 | `409 too_many_calendars` |
| Stored event data across a user's calendars | 64 MiB of JSON | `413 account_full` |

An import is checked once, after all its events are written, and rolled back as a whole if the result is over a limit. Edits that make an event smaller are always accepted.

## Moving events between calendars

`POST /api/calendars/<id>/move {uids, targetCalendarId}` moves whole events (a master with its overrides, by UID) to another account calendar in one transaction, keeping their UIDs and stored data. It needs editor rights on both calendars, refuses a UID the target already has (`409 uid_exists`), and checks the target's limits. Event-level invites and share links point at the old calendar, so they are removed, as when the event is deleted.

Moves between this device and the account go through `POST /api/calendars/<id>/import {events, createOnly: true}` (to the account; `createOnly` refuses a UID the calendar already has with `409 uid_exists` instead of overwriting it) or a device write plus `POST /api/calendars/<id>/delete-events {uids}` (to the device, up to 1,000 events per request). The app refuses a move onto an event that already exists at the destination, on either side, and undo restores both halves of a move. Undo and redo write large changes with these same bulk requests, so they stay within the API rate limit.

## Subscriptions to external calendars

`POST /api/calendars {sourceUrl, name?, color?, timezone?}` creates a calendar whose events come from an `.ics` URL (`webcal://` is fetched as `https://`). The server fetches it once before creating the calendar, so a bad link is reported straight away, then every three hours (`POST /api/calendars/<id>/refresh` asks for one now, at most once a minute). Each refresh replaces the calendar's events; a failed refresh keeps the previous ones and records the error. Its events cannot be edited (`409 read_only`), and it cannot get editor invites, but it can be shared like any calendar.

The server fetches URLs that users type in, so `src/server/subscriptions.ts` guards each request: `http`/`https` only, no credentials in the URL, every resolved address (also after each of up to three redirects) must be public — loopback, private, link-local, CGNAT (Tailscale's 100.64/10), multicast and reserved ranges are refused —, no compression, 5 MB and 15 seconds at most, a new socket per request, and the bodies of redirects and errors are never read. A blocked address, an unknown host name and a refused connection all report `unreachable`, so the codes reveal nothing about the server's own network. Parsing runs on the server's request thread, so it is bounded: the parser stops on a feed with more events than a calendar may hold (10,000), more date work than a full calendar needs (150,000 units: 1 per UTC or date-only value, 3 per value that needs a zone conversion), or components nested more than 32 deep. Up to 20 subscriptions per user; two new subscriptions and four manual refreshes a minute per user.

## How subscribers' apps behave

| App | Subscribe | Refresh |
|---|---|---|
| Apple Calendar (macOS, iOS) | `webcal://…` opens the subscribe dialog | the interval chosen in the subscription settings (down to every 5 minutes on macOS) |
| Google Calendar | `https://calendar.google.com/calendar/r?cid=webcal://…`, desktop web only (the mobile app cannot add subscriptions) | decided by Google, typically every few hours; it ignores `REFRESH-INTERVAL` |
| Outlook.com / Microsoft 365 | `…/calendar/0/addfromweb?url=…&name=…` | decided by Microsoft |

## Managing links

The owner creates links from the Account view or an event's menu (Share live link), and can:
- name them, set an expiry, revoke them
- give a link a **new URL** (rotate): the old URL stops working at once
- see when each link was last fetched and how often
- remove people who joined through an invite

A collaborator sees only their personal subscription link, and can revoke or rotate it.
