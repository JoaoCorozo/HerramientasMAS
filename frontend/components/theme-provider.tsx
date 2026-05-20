'use client'

import * as React from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  resolvedTheme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue>({
  resolvedTheme: 'dark',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = React.useState<Theme>('dark')

  React.useEffect(() => {
    // Lee el tema guardado en localStorage, por defecto 'dark'
    const saved = (localStorage.getItem('app-theme') as Theme) ?? 'dark'
    applyTheme(saved)
    setResolvedTheme(saved)
  }, [])

  const setTheme = React.useCallback((newTheme: Theme) => {
    localStorage.setItem('app-theme', newTheme)
    applyTheme(newTheme)
    setResolvedTheme(newTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
}

export function useTheme() {
  return React.useContext(ThemeContext)
}
