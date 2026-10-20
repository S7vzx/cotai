import { defineConfig, devices } from '@playwright/test'

// Os testes ponta a ponta usam um Supabase simulado (tests/e2e/mock-supabase.ts),
// então rodam sem Docker. CHROMIUM_PATH permite usar um Chromium já instalado.
const executablePath = process.env.CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    locale: 'pt-BR',
    timezoneId: 'America/Maceio',
    launchOptions: executablePath ? { executablePath, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] } : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: true,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_SITE_URL: 'http://localhost:5199',
    },
  },
})
