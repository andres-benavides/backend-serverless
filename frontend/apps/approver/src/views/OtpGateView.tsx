import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from '@amm/ui';
import {
  ApiError,
  createApiClient,
  type ApprovalView,
  type PurchaseDetailForApprover,
} from '@amm/api';

interface Props {
  approvalToken: string;
  onVerified: (purchase: PurchaseDetailForApprover) => void;
}

export const OtpGateView = ({ approvalToken, onVerified }: Props) => {
  const [approval, setApproval] = useState<ApprovalView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    createApiClient()
      .getApproval(approvalToken)
      .then((result) => {
        if (!cancelled) setApproval(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(
            cause instanceof Error ? cause.message : 'Error inesperado',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [approvalToken]);

  const sendOtp = async () => {
    setBusy(true);
    setError(null);

    try {
      await createApiClient().requestOtp(approvalToken);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setAttemptsLeft(null);

    try {
      onVerified(await createApiClient().verifyOtp(approvalToken, otp));
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setAttemptsLeft(cause.attemptsLeft ?? null);
      } else {
        setError('Error inesperado');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loadError !== null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo abrir la aprobacion</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (approval === null) {
    return <Skeleton className="h-64 w-full" data-testid="approval-loading" />;
  }

  if (!approval.active) {
    return (
      <Alert>
        <AlertTitle>Esta aprobacion no esta activa</AlertTitle>
        <AlertDescription>
          {approval.status === 'PENDING'
            ? 'Todavia no es tu turno. Recibiras un correo cuando el aprobador anterior firme.'
            : 'Esta aprobacion ya fue procesada.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void verify(event);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Verificacion en dos pasos</CardTitle>
          <CardDescription>
            Antes de mostrarte el detalle de la compra necesitamos validar un
            codigo de 6 digitos. Vence a los 3 minutos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error !== null && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
              {attemptsLeft !== null && (
                <AlertDescription>
                  Te quedan {attemptsLeft} intentos.
                </AlertDescription>
              )}
            </Alert>
          )}

          {!sent ? (
            <p className="text-sm text-muted-foreground">
              Pulsa el boton para recibir tu codigo.
            </p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="otp">Codigo</Label>
              <Input
                id="otp"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value);
                }}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="font-mono tracking-[0.4em]"
                required
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="gap-2">
          {!sent ? (
            <Button
              type="button"
              onClick={() => void sendOtp()}
              disabled={busy}
            >
              {busy ? 'Enviando...' : 'Enviar codigo'}
            </Button>
          ) : (
            <>
              <Button type="submit" disabled={busy || otp.length !== 6}>
                {busy ? 'Verificando...' : 'Verificar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void sendOtp()}
                disabled={busy}
              >
                Reenviar
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </form>
  );
};
