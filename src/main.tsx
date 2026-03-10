/**
 * main.tsx
 * 
 * The entry point for the React application. It initializes the React root element
 * and renders the main App component within StrictMode.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
