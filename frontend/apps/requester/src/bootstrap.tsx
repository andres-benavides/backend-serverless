import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@amm/ui/styles/globals.css';
import { RequesterApp } from './RequesterApp';

const container = document.getElementById('root');

if (!container) {
  throw new Error('No se encontro el contenedor #root');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <div className="mx-auto max-w-5xl p-8">
        <Routes>
          <Route path="/*" element={<RequesterApp />} />
        </Routes>
      </div>
    </BrowserRouter>
  </StrictMode>,
);
