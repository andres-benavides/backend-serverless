import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@amm/ui/styles/globals.css';
import { App } from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('No se encontro el contenedor #root');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
);
