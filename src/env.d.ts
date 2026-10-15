/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_UMAMI_SCRIPT_URL?: string
  readonly PUBLIC_UMAMI_WEBSITE_ID?: string
  readonly PUBLIC_UMAMI_DOMAINS?: string
  /** 'true' in the server build (accounts, sharing), 'false' in the static Pages build. */
  readonly PUBLIC_CLOUD: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
