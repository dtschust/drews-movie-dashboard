import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { EmbeddedAppProvider } from './context/EmbeddedAppContext.jsx';

if (typeof document !== 'undefined') {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      if (stored === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }
}

const rawIsEmbedded = import.meta.env?.IS_EMBEDDED;
const isEmbeddedApp =
  typeof rawIsEmbedded === 'string'
    ? ['true', '1'].includes(rawIsEmbedded.toLowerCase())
    : Boolean(rawIsEmbedded);

const root = createRoot(document.getElementById('drews-movie-dashboard-root'));
root.render(
  <React.StrictMode>
    <HashRouter>
      <EmbeddedAppProvider isEmbeddedApp={isEmbeddedApp}>
        <App />
      </EmbeddedAppProvider>
    </HashRouter>
  </React.StrictMode>
);
