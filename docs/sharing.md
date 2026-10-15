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
| `busy` | `SUMMARY:Busy`, times, recurrence, `CLASS:PRIVATE`; description, location, attendees, organizer, URL, categories and colour removed; free (`TRANSP:TRANSPARENT`) and cancelled events left out |
| `limited` | summary, times, recurrence, status; description, location, attendees, organizer, URL and conference link removed |
| `full` | all event fields |
| `edit` | not a feed (404). Opening the share page asks for a sign-in. Joining makes the user an editor and creates a personal `full` link for them, which is removed again when they leave or are removed. |

Every level leaves out VALARMs (subscribers set their own alerts). The fields come from `redactEvent()` in `src/lib/redact.ts`, the same function the "Strip personal data" export option uses.

## Feed format

- `METHOD:PUBLISH`, `NAME` / `X-WR-CALNAME` (the link's name, the calendar or event name, or "Busy" for busy links), `X-WR-TIMEZONE`, `COLOR` + `X-APPLE-CALENDAR-COLOR`, `REFRESH-INTERVAL;VALUE=DURATION:PT1H` + `X-PUBLISHED-TTL:PT1H`, `SOURCE`
- Stable UIDs; `SEQUENCE` goes up on every server-side change (also on undo)
- `ETag` (content hash) and `Last-Modified`; `If-None-Match` / `If-Modified-Since` get `304`
- Unknown, revoked, expired and invite tokens all answer `404`
- Rate limits: 120 requests/min per IP, 60/min per token
- `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` on feeds and share pages

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
