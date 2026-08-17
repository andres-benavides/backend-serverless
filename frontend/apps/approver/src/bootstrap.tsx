import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@amm/ui/styles/globals.css';
import { ApproverApp } from './ApproverApp';

const container = document.getElementById('root');

if (!container) {
  throw new Error('No se encontro el contenedor #root');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <div className="mx-auto max-w-2xl p-8">
        <ApproverApp />
      </div>
    </BrowserRouter>
  </StrictMode>,
);
