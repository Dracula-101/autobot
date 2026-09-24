/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_BASE: string
  /** '1' = run entirely on this device (no Supabase) */
  readonly VITE_FORCE_LOCAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
