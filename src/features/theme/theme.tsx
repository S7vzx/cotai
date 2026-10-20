import { Monitor, Moon, Sun } from 'lucide-react'
import * as React from 'react'
import { Segmented } from '@/components/ui/controls'

type Theme = 'system' | 'light' | 'dark'

function read(): Theme {
  try {
    const t = localStorage.getItem('cotai-theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>(read)
  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t)
    try {
      if (t === 'system') localStorage.removeItem('cotai-theme')
      else localStorage.setItem('cotai-theme', t)
    } catch {
      /* armazenamento indisponível: vale só nesta sessão */
    }
    if (t === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = t
  }, [])
  return { theme, setTheme }
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Segmented<Theme>
      size="sm"
      aria-label="Tema"
      value={theme}
      onChange={setTheme}
      options={[
        { value: 'light', label: <Sun className="size-3.5" />, title: 'Claro' },
        { value: 'system', label: <Monitor className="size-3.5" />, title: 'Automático' },
        { value: 'dark', label: <Moon className="size-3.5" />, title: 'Escuro' },
      ]}
    />
  )
}
