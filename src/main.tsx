import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from '@/app/router'
import { SetupNeeded } from '@/pages/setup-needed'
import { AuthProvider } from '@/features/auth/auth'
import { isConfigured } from '@/lib/supabase'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster
            position="top-center"
            toastOptions={{
              className: '!rounded-2xl !bg-surface !text-fg !border-line !shadow-xl !font-sans !text-[15px]',
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <SetupNeeded />
    )}
  </StrictMode>,
)
