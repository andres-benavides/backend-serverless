import { useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
} from '@amm/ui';
import {
  createApiClient,
  type ApprovalDecision,
  type DecisionResult,
  type PurchaseDetailForApprover,
} from '@amm/api';

interface Props {
  approvalToken: string;
  purchase: PurchaseDetailForApprover;
}

const formatAmount = (amount: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);

export const ApprovalDetailView = ({ approvalToken, purchase }: Props) => {
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decide = async (decision: ApprovalDecision) => {
    setBusy(true);
    setError(null);

    try {
      setResult(
        await createApiClient().submitDecision(approvalToken, decision),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (result !== null) {
    return (
      <Alert>
        <AlertTitle>
          {result.status === 'SIGNED'
            ? 'Firmaste la solicitud'
            : 'Rechazaste la solicitud'}
        </AlertTitle>
        <AlertDescription>
          Registrado el {new Date(result.decidedAt).toLocaleString('es-CO')}. Ya
          puedes cerrar esta ventana.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{purchase.title}</CardTitle>
            <CardDescription>{purchase.description}</CardDescription>
          </div>
          <Badge variant="secondary">
            Aprobador {purchase.approver.order} · {purchase.approver.role}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error !== null && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo registrar tu decision</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Monto</dt>
            <dd className="font-mono text-sm">
              {formatAmount(purchase.amount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Solicitante</dt>
            <dd className="text-sm">{purchase.requester.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Creada</dt>
            <dd className="text-sm">
              {new Date(purchase.createdAt).toLocaleString('es-CO')}
            </dd>
          </div>
        </dl>

        <Separator />

        <p className="text-sm text-muted-foreground">
          Tu decision queda registrada con tu nombre y la fecha, y no se puede
          deshacer.
        </p>
      </CardContent>

      <CardFooter className="gap-2">
        <Button onClick={() => void decide('APPROVE')} disabled={busy}>
          {busy ? 'Registrando...' : 'Aprobar'}
        </Button>
        <Button
          variant="destructive"
          onClick={() => void decide('REJECT')}
          disabled={busy}
        >
          Rechazar
        </Button>
      </CardFooter>
    </Card>
  );
};
