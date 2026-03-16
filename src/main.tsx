import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useAppStore } from './store/useAppStore';

// Capture PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later.
  useAppStore.getState().setDeferredPrompt(e);
});

// Registrar o Service Worker principal (necessário para push funcionar em 2º plano)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[SW] Falha ao registar sw.js:', err);
    });

    // Quando um novo SW assumir o controle, faz refresh apenas uma vez por aba
    let refreshing = sessionStorage.getItem('sw-refreshed') === '1';
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      sessionStorage.setItem('sw-refreshed', '1');
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
