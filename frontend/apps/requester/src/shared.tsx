import { Badge } from '@amm/ui';
import type { ApprovalStatus, RequestStatus } from '@amm/api';

export const formatAmount = (amount: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const requestLabels: Record<RequestStatus, string> = {
  PENDING: 'Pendiente',
  REJECTED: 'Rechazada',
  COMPLETED: 'Completada',
};

const approvalLabels: Record<ApprovalStatus, string> = {
  PENDING: 'Pendiente',
  SIGNED: 'Firmado',
  REJECTED: 'Rechazado',
};

export const RequestStatusBadge = ({ status }: { status: RequestStatus }) => (
  <Badge variant={status === 'REJECTED' ? 'destructive' : 'secondary'}>
    {requestLabels[status]}
  </Badge>
);

export const ApprovalStatusBadge = ({ status }: { status: ApprovalStatus }) => (
  <Badge variant={status === 'REJECTED' ? 'destructive' : 'secondary'}>
    {approvalLabels[status]}
  </Badge>
);
