# Accounts — Logto

CalGen signs users in through the self-hosted Logto IdP at `https://auth.robyrew.com`, registered as a **Traditional Web** application. The redirect, PKCE and code exchange run on the server (`src/server/logto/`, built on `@logto/node`). The OIDC tokens are kept server-side in SQLite (`logto_sessions`), and the browser only holds an opaque, `httpOnly` session-id cookie. Cross-app recipe: Obsidian → Infrastructure → VPS-Ionos → *13 App integration with Logto*.

Accounts exist only in the server build. Without `LOGTO_*` set, `/api/me` reports `available: false`, the Account view says accounts are unavailable, and the app keeps working on the device.

## Register the application (Logto console, over Tailscale)

1. **Applications → Create → Traditional Web**, name `CalGen`. Register it as **first-party**: a third-party app rejects the `profile`/`email` scopes and the sign-in loops (see the 2026-06-25 note in *13 App integration with Logto*).
2. **Redirect URI**: `https://calendar.robyrew.com/api/auth/callback`
3. **Post sign-out redirect URI**: `https://calendar.robyrew.com/`
4. Copy the **App ID** and **App Secret**.

For local development, register a second app (or add URIs to a dev app) with `http://localhost:5173/api/auth/callback` and `http://localhost:5173/`.

## Environment

| Variable | Value |
|---|---|
| `LOGTO_ENDPOINT` | `https://auth.robyrew.com` |
| `LOGTO_APP_ID` | App ID |
| `LOGTO_APP_SECRET` | App Secret — server env only (Dokploy), never in git or the bundle |
| `PUBLIC_SITE_URL` | `https://calendar.robyrew.com` — public origin; Traefik terminates TLS, so redirect URIs are built from this, not from the request |
| `DB_URL` | `file:/app/data/calendar.db` (Dockerfile default) |

## Routes

| Route | |
|---|---|
| `GET /api/auth/sign-in?returnTo=/path` | Starts sign-in. `returnTo` must be a local path. |
| `GET /api/auth/callback` | Exchanges the code; a new session id replaces the pre-login one. On failure it lands on `/?auth_error=1`, and the app shows a message. |
| `GET\|POST /api/auth/sign-out` | Ends the Logto SSO session (end-session endpoint) and the local one. |
| `GET /api/me` | `{ available, signedIn, user }` for the client. |

## Users and data

`users` has one row per Logto subject (`logto_sub`, unique), with the email and name cached from the ID token. Everything the user owns references `users.id`: calendars, memberships, share links. Authorisation is decided server-side in `src/server/authz.ts`:

| Role | Can |
|---|---|
| owner | everything on the calendar, including share links and removing people |
| editor | create, edit and delete events (a calendar editor: all events; an event editor: that event and its occurrences) |

A request without access gets 404, not 403, so ids cannot be probed. Writes require `Content-Type: application/json`, which a cross-site form cannot send. Together with `SameSite=Lax` cookies and Astro's `checkOrigin`, this is the CSRF protection.

### Preferences

`user_prefs` holds one JSON document per user with three sections: `settings`, `templates` (custom ones; built-ins are seeded per device) and `hidden` (calendars hidden from the views). Each section has a version. The client (`src/lib/cloud/prefs-sync.ts`) writes a section with `PUT /api/prefs/<section> {value, baseVersion}`; when another device wrote in between, the server answers `409` with its copy, and the client merges three ways against the value both last agreed on (per setting, per template, per hidden calendar), so each side keeps its own changes, deletions included, and writes again. A device's first sync for a user takes the account's settings and adds its own templates and hidden calendars; when a different user signs in on the same browser, that user's account replaces the previous user's preferences on the device and nothing is uploaded. "Clear all data" in Settings clears only this device.

### Export and deletion

- `GET /api/account/export`: a JSON download, streamed 200 events at a time and only as fast as the client reads it (server.mjs hands the Node response to the route), with the user, preferences, owned calendars with their events, every share link on them (revoked ones too, without tokens) and members, the user's own links on other people's calendars, and references to what others shared with the user. One export at a time and two a minute per user.
- `DELETE /api/account {"confirm":"DELETE"}`: deletes the user's calendars (their events, links and other people's access to them), the user's memberships and links elsewhere, preferences, and every stored session whose ID token belongs to the user, then clears the session cookie. The Logto identity at auth.robyrew.com is not touched; signing in again starts an empty account.

## Cookie

`__Host-cg_sid` on https (Secure, Path=/, host-only), `cg_sid` on http for local development. Each stored session records the Logto subject (`logto_sessions.subject`, indexed; empty before sign-in), so all of a user's sessions can be ended at once when the account is deleted. `HttpOnly`, `SameSite=Lax`, 14 days.
