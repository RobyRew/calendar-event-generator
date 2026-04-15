import { useMemo } from 'react'

interface PlatformInfo {
  isMac: boolean
  isIOS: boolean
  isSafari: boolean
  isTouchDevice: boolean
  modKey: string
  modSymbol: string
}

export function usePlatform(): PlatformInfo {
  return useMemo(() => {
    const ua = navigator.userAgent
    const isMac = /Mac/.test(navigator.platform) || /Macintosh/.test(ua)
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (isMac && navigator.maxTouchPoints > 1)
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    return {
      isMac,
      isIOS,
      isSafari,
      isTouchDevice,
      modKey: isMac ? 'Meta' : 'Control',
      modSymbol: isMac ? '⌘' : 'Ctrl',
    }
  }, [])
}
