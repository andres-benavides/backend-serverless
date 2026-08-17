import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@amm/ui';
import { createApiClient, type PurchaseRequestDetail } from '@amm/api';
import {
  ApprovalStatusBadge,
  RequestStatusBadge,
  formatAmount,
  formatDate,
} from '../shared';

export const RequestDetailView = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [detail, setDetail] = useState<PurchaseRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (requestId === undefined) return;

    let cancelled = false;

    createApiClient()
      .getRequest(requestId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Error inesperado');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const downloadEvidence = async () => {
    if (requestId === undefined) return;

    setEvidenceError(null);
    setDownloading(true);

    try {
      const evidence = await createApiClient().getEvidenceUrl(requestId);
      window.open(evidence.url, '_blank', 'noopener');
    } catch (cause) {
      setEvidenceError(
        cause instanceof Error ? cause.message : 'Error inesperado',
      );
    } finally {
      setDownloading(false);
    }
  };

  if (error !== null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar la solicitud</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (detail === null) {
    return <Skeleton className="h-64 w-full" data-testid="detail-loading" />;
  }

  const { request, approvers } = detail;
  const completed = request.status === 'COMPLETED';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{request.title}</CardTitle>
              <CardDescription>{request.description}</CardDescription>
            </div>
            <RequestStatusBadge status={request.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Monto</dt>
              <dd className="font-mono text-sm">
                {formatAmount(request.amount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Solicitante</dt>
              <dd className="text-sm">{request.requester.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Creada</dt>
              <dd className="text-sm">{formatDate(request.createdAt)}</dd>
            </div>
          </dl>

          <Separator />

          {evidenceError !== null && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo obtener la evidencia</AlertTitle>
              <AlertDescription>{evidenceError}</AlertDescription>
            </Alert>
          )}

          {completed ? (
            <Button
              onClick={() => void downloadEvidence()}
              disabled={downloading}
            >
              {downloading ? 'Generando enlace...' : 'Descargar PDF'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              El PDF de evidencia estara disponible cuando los tres aprobadores
              firmen.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aprobadores</CardTitle>
          <CardDescription>Firman en orden, uno tras otro</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvers.map((approver) => (
                <TableRow key={approver.approverId}>
                  <TableCell>{approver.order}</TableCell>
                  <TableCell className="font-medium">{approver.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {approver.role}
                  </TableCell>
                  <TableCell>
                    <ApprovalStatusBadge status={approver.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(approver.signedAt ?? approver.rejectedAt)
                      ? formatDate(
                          (approver.signedAt ?? approver.rejectedAt) as string,
                        )
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
