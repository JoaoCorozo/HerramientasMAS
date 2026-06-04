'use client'

import * as React from 'react'
import { type ColorMode, type ThemePreset, isThemePreset } from '@/lib/themes'

const STORAGE_THEME = 'app-theme'
const STORAGE_PRESET = 'app-theme-preset'
const STORAGE_PRESET_LEGACY = 'app-palette'

interface ThemeContextValue {
  resolvedTheme: ColorMode
  themePreset: ThemePreset
  setTheme: (theme: ColorMode) => void
  setThemePreset: (preset: ThemePreset) => void
  /** @deprecated use setThemePreset */
  setPalette: (preset: ThemePreset) => void
  /** @deprecated use themePreset */
  palette: ThemePreset
}

const ThemeContext = React.createContext<ThemeContextValue>({
  resolvedTheme: 'dark',
  themePreset: 'azul',
  setTheme: () => {},
  setThemePreset: () => {},
  setPalette: () => {},
  palette: 'azul',
})

function readStoredPreset(): ThemePreset {
  if (typeof window === 'undefined') return 'azul'
  const preset =
    localStorage.getItem(STORAGE_PRESET) ??
    localStorage.getItem(STORAGE_PRESET_LEGACY)
  return preset && isThemePreset(preset) ? preset : 'azul'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = React.useState<ColorMode>('dark')
  const [themePreset, setThemePresetState] = React.useState<ThemePreset>('azul')

  React.useEffect(() => {
    const savedTheme = (localStorage.getItem(STORAGE_THEME) as ColorMode) ?? 'dark'
    const savedPreset = readStoredPreset()
    applyTheme(savedTheme)
    applyThemePreset(savedPreset)
    setResolvedTheme(savedTheme)
    setThemePresetState(savedPreset)
    localStorage.setItem(STORAGE_PRESET, savedPreset)
  }, [])

  const setTheme = React.useCallback((newTheme: ColorMode) => {
    localStorage.setItem(STORAGE_THEME, newTheme)
    applyTheme(newTheme)
    setResolvedTheme(newTheme)
  }, [])

  const setThemePreset = React.useCallback((newPreset: ThemePreset) => {
    localStorage.setItem(STORAGE_PRESET, newPreset)
    localStorage.removeItem(STORAGE_PRESET_LEGACY)
    applyThemePreset(newPreset)
    setThemePresetState(newPreset)
  }, [])

  return (
    <ThemeContext.Provider
      value={{
        resolvedTheme,
        themePreset,
        palette: themePreset,
        setTheme,
        setThemePreset,
        setPalette: setThemePreset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

function applyTheme(theme: ColorMode) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
  // Forzar repintado de variables CSS al cambiar modo
  root.style.colorScheme = theme
}

function applyThemePreset(preset: ThemePreset) {
  document.documentElement.setAttribute('data-theme', preset)
  document.documentElement.removeAttribute('data-palette')
}

export function useTheme() {
  return React.useContext(ThemeContext)
}
