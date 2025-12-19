/**
 * Application Entry Point
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for PWA (only in production or if file exists)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Check if service worker file exists before registering
    fetch('/sw.js', {method: 'HEAD'})
      .then((response) => {
        if (response.ok) {
          return navigator.serviceWorker.register('/sw.js');
        }
        // Service worker file doesn't exist (dev mode), skip registration
        return null;
      })
      .then((registration) => {
        if (registration) {
          console.warn('Service Worker registered:', registration.scope);
        }
      })
      .catch((error) => {
        // Only log errors if we actually tried to register (file exists)
        // Silently ignore 404 errors in dev mode
        if (error instanceof TypeError && error.message.includes('404')) {
          // Service worker not available in dev mode, this is expected
          return;
        }
        console.error('Service Worker registration failed:', error);
      });
  });
}


