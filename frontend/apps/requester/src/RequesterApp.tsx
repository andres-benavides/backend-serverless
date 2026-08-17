import { Route, Routes } from 'react-router-dom';
import { CreateRequestView } from './views/CreateRequestView';
import { DashboardView } from './views/DashboardView';
import { RequestDetailView } from './views/RequestDetailView';

export const RequesterApp = () => (
  <Routes>
    <Route index element={<DashboardView />} />
    <Route path="new" element={<CreateRequestView />} />
    <Route path=":requestId" element={<RequestDetailView />} />
  </Routes>
);
