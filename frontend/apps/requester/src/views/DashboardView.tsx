import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@amm/ui';
import { createApiClient, type PurchaseRequestSummary } from '@amm/api';
import { RequestStatusBadge, formatAmount, formatDate } from '../shared';

const REQUESTER_ID = 'user-001';

export const DashboardView = () => {
  const [requests, setRequests] = useState<PurchaseRequestSummary[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      setRequests(await createApiClient().listRequests(REQUESTER_ID));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis solicitudes</CardTitle>
        <CardDescription>
          Estado de las solicitudes creadas por {REQUESTER_ID}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error !== null && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>No se pudieron cargar las solicitudes</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {requests === null && error === null && (
          <div className="space-y-2" data-testid="dashboard-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {requests !== null && requests.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Todavia no has creado ninguna solicitud.
            </p>
            <Button asChild className="mt-4">
              <Link to="/requests/new">Crear la primera</Link>
            </Button>
          </div>
        )}

        {requests !== null && requests.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titulo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.requestId}>
                  <TableCell className="font-medium">{request.title}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatAmount(request.amount)}
                  </TableCell>
                  <TableCell>
                    <RequestStatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.status === 'PENDING'
                      ? `Aprobador ${String(request.currentApproverOrder)}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/requests/${request.requestId}`}>Ver</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
