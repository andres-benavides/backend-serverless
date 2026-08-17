import { Suspense, lazy } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Skeleton } from '@amm/ui';
import { RemoteBoundary } from './RemoteBoundary';

const RequesterApp = lazy(async () => {
  const module = (await import('requester/RequesterApp')) as {
    RequesterApp: React.ComponentType;
  };

  return { default: module.RequesterApp };
});

const ApproverApp = lazy(async () => {
  const module = (await import('approver/ApproverApp')) as {
    ApproverApp: React.ComponentType;
  };

  return { default: module.ApproverApp };
});

const MailboxApp = lazy(async () => {
  const module = (await import('approver/MailboxApp')) as {
    MailboxApp: React.ComponentType;
  };

  return { default: module.MailboxApp };
});

const Loading = () => (
  <div className="space-y-3">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const App = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">
          Aprobaciones de compra
        </span>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink
            to="/requests"
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 transition-colors ${
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            Solicitudes
          </NavLink>
          <NavLink
            to="/requests/new"
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 transition-colors ${
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            Nueva solicitud
          </NavLink>
          <NavLink
            to="/inbox"
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 transition-colors ${
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            Bandeja
          </NavLink>
        </nav>
      </div>
    </header>

    <main className="mx-auto max-w-5xl px-6 py-8">
      <RemoteBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/requests" replace />} />
            <Route path="/requests/*" element={<RequesterApp />} />
            <Route path="/approve" element={<ApproverApp />} />
            <Route path="/inbox" element={<MailboxApp />} />
            <Route
              path="*"
              element={
                <p className="text-sm text-muted-foreground">
                  La pagina que buscas no existe.
                </p>
              }
            />
          </Routes>
        </Suspense>
      </RemoteBoundary>
    </main>
  </div>
);
