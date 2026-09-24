import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? process.env.VITE_BASE || '/autobot/' : '/'

  return {
    plugins: [react()],
    base,
    resolve: {
      alias: {
        // Pure logic shared with the Supabase Edge Functions (Deno)
        '@core': fileURLToPath(new URL('./supabase/functions/_shared/core', import.meta.url)),
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/**/*.deno.test.ts'],
    },
  }
})
