import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { FinanceProvider } from './context/FinanceContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode><BrowserRouter><ThemeProvider><AuthProvider><FinanceProvider><App/></FinanceProvider></AuthProvider></ThemeProvider></BrowserRouter></StrictMode>,
)
