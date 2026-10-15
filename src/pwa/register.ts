// Registers the workbox service worker generated at build time (integrations/pwa.mjs).
// When an update takes control, reload once so the page runs the new bundle.
if ('serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return
      reloaded = true
      window.location.reload()
    })
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Offline support is optional; the app works without it.
    })
  })
}

export {}
