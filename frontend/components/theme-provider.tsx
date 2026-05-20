'use client'

import * as React from 'react'

type Theme = 'dark' | 'light'
type Palette = 'azul' | 'violeta' | 'verde' | 'naranja' | 'rosa' | 'cyan' | 'rojo' | 'ambar'

interface ThemeContextValue {
  resolvedTheme: Theme
  palette: Palette
  setTheme: (theme: Theme) => void
  setPalette: (palette: Palette) => void
}

const ThemeContext = React.createContext<ThemeContextValue>({
  resolvedTheme: 'dark',
  palette: 'azul',
  setTheme: () => {},
  setPalette: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = React.useState<Theme>('dark')
  const [palette, setPaletteState] = React.useState<Palette>('azul')

  React.useEffect(() => {
    const savedTheme = (localStorage.getItem('app-theme') as Theme) ?? 'dark'
    const savedPalette = (localStorage.getItem('app-palette') as Palette) ?? 'azul'
    applyTheme(savedTheme)
    applyPalette(savedPalette)
    setResolvedTheme(savedTheme)
    setPaletteState(savedPalette)
  }, [])

  const setTheme = React.useCallback((newTheme: Theme) => {
    localStorage.setItem('app-theme', newTheme)
    applyTheme(newTheme)
    setResolvedTheme(newTheme)
  }, [])

  const setPalette = React.useCallback((newPalette: Palette) => {
    localStorage.setItem('app-palette', newPalette)
    applyPalette(newPalette)
    setPaletteState(newPalette)
  }, [])

  return (
    <ThemeContext.Provider value={{ resolvedTheme, palette, setTheme, setPalette }}>
      {children}
    </ThemeContext.Provider>
  )
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
}

function applyPalette(palette: Palette) {
  // 'azul' es la paleta por defecto — no requiere data-palette
  if (palette === 'azul') {
    document.documentElement.removeAttribute('data-palette')
  } else {
    document.documentElement.setAttribute('data-palette', palette)
  }
}

export function useTheme() {
  return React.useContext(ThemeContext)
}
