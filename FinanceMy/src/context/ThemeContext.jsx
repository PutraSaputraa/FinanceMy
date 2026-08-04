import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('financemy-theme') || 'light')
  const [hiddenAmounts, setHiddenAmounts] = useState(() => localStorage.getItem('financemy-hide-amounts') === 'true')
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('financemy-theme', theme) }, [theme])
  useEffect(() => localStorage.setItem('financemy-hide-amounts', hiddenAmounts), [hiddenAmounts])
  const value = useMemo(() => ({ theme, setTheme, hiddenAmounts, setHiddenAmounts, toggleTheme: () => setTheme((value) => value === 'light' ? 'dark' : 'light') }), [theme, hiddenAmounts])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
