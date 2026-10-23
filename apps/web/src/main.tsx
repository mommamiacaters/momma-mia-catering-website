import { createRoot } from 'react-dom/client';
import 'primeicons/primeicons.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// A deploy replaces every hashed chunk, so a tab opened before it 404s on its
// next lazy page. Reload once onto the new build instead of a blank screen.
// A reload within the last 10 s means the chunk is really gone: let it fail.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('chunk-reload-at') ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem('chunk-reload-at', String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
