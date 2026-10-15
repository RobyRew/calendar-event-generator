// "Subscribe" URLs for a live feed. Calendar apps fetch the feed themselves on a
// schedule, so edits reach subscribers without them doing anything:
//   Apple Calendar — webcal:// opens the subscribe dialog (macOS, iOS)
//   Google Calendar — ?cid= adds it by URL (Google's desktop web; the mobile app
//     cannot add subscriptions, and Google decides how often it refreshes)
//   Outlook / Microsoft 365 — addfromweb
// Pure module: used by the server's share page and the client's share dialog.

export interface SubscribeLinks {
  /** Landing page that explains the share and offers the buttons below. */
  page: string
  /** The feed itself. */
  https: string
  webcal: string
  google: string
  outlookCom: string
  office365: string
}

export function feedUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/feed/${token}.ics`
}

export function subscribeLinks(origin: string, token: string, name: string): SubscribeLinks {
  const base = origin.replace(/\/+$/, '')
  const https = feedUrl(base, token)
  const webcal = https.replace(/^https?:/, 'webcal:')
  const q = (url: string) => `url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  return {
    page: `${base}/s/${token}`,
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    outlookCom: `https://outlook.live.com/calendar/0/addfromweb?${q(https)}`,
    office365: `https://outlook.office.com/calendar/0/addfromweb?${q(https)}`,
  }
}
