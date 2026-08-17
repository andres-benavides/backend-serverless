import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@amm/ui';
import { createApiClient } from '@amm/api';
import type { MockMail } from '@amm/api';

const tokenFrom = (approvalLink: string): string => {
  try {
    return new URL(approvalLink).searchParams.get('approver_token') ?? '';
  } catch {
    return '';
  }
};

const localLink = (mail: MockMail): string =>
  `/approve?solicitud_id=${mail.requestId}&approver_token=${tokenFrom(mail.approvalLink)}`;

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', {
    timeStyle: 'medium',
    dateStyle: 'short',
  });

export const MailboxApp = () => {
  const [mails, setMails] = useState<MockMail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      setMails(await createApiClient().listMockMails());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    createApiClient()
      .listMockMails()
      .then((result) => {
        if (!cancelled) setMails(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Error inesperado');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Bandeja de demostracion</AlertTitle>
        <AlertDescription>
          Reemplaza al correo real. Expone el token de aprobacion y el OTP, que
          en produccion solo llegarian al buzon del aprobador. Debe eliminarse o
          protegerse antes de cualquier uso real.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Correos simulados</CardTitle>
              <CardDescription>
                Solo aparecen los del aprobador que tiene el turno
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Actualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {error !== null && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo leer el buzon</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mails === null && error === null && (
            <div className="space-y-2" data-testid="mailbox-loading">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {mails !== null && mails.length === 0 && (
            <p className="text-sm text-muted-foreground">
              El buzon esta vacio. Crea una solicitud para que se active el
              primer aprobador.
            </p>
          )}

          {mails?.map((mail) => (
            <div
              key={mail.mailId}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={mail.mailType === 'OTP' ? 'default' : 'secondary'}
                  >
                    {mail.mailType === 'OTP' ? 'Codigo' : 'Invitacion'}
                  </Badge>
                  <span className="text-sm font-medium">{mail.to}</span>
                  <span className="text-xs text-muted-foreground">
                    Aprobador {mail.order} · {mail.role}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(mail.sentAt)}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {mail.subject}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button asChild size="sm">
                  <a href={localLink(mail)}>Abrir aprobacion</a>
                </Button>

                {mail.otp !== undefined && (
                  <span className="font-mono text-lg tracking-[0.3em]">
                    {mail.otp}
                  </span>
                )}

                {mail.otpExpiresAt !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    vence {formatTime(mail.otpExpiresAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
