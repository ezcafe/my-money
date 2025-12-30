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

// Register service worker for PWA (only in production)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.port === '3000';

    if (isDevelopment) {
      // In development, unregister any existing service workers to prevent caching issues
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister().then((success) => {
            if (success) {
              console.log('Service Worker unregistered for development mode');
            }
          });
        }
      });
      // Clear all caches in development
      if ('caches' in window) {
        void caches.keys().then((cacheNames) => {
          return Promise.all(cacheNames.map((name) => caches.delete(name)));
        }).then(() => {
          console.log('All caches cleared for development mode');
        });
      }
      return;
    }

    // In production, register the service worker
    void fetch('/sw.js', {method: 'HEAD'})
      .then((response) => {
        if (response.ok) {
          return navigator.serviceWorker.register('/sw.js');
        }
        return null;
      })
      .then((registration) => {
        if (registration) {
          console.log('Service Worker registered:', registration.scope);
        }
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}


