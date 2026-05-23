import { createRoot } from 'react-dom/client';
import { PrimeReactProvider } from 'primereact/api';
import 'primeicons/primeicons.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <PrimeReactProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </PrimeReactProvider>
);
