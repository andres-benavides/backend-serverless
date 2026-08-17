import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@amm/ui';
import type { PurchaseDetailForApprover } from '@amm/api';
import { OtpGateView } from './views/OtpGateView';
import { ApprovalDetailView } from './views/ApprovalDetailView';

export const ApproverApp = () => {
  const [searchParams] = useSearchParams();
  const approvalToken = searchParams.get('approver_token');
  const [purchase, setPurchase] = useState<PurchaseDetailForApprover | null>(
    null,
  );

  if (approvalToken === null || approvalToken === '') {
    return (
      <Alert variant="destructive">
        <AlertTitle>Enlace invalido</AlertTitle>
        <AlertDescription>
          Al enlace le falta el parametro <code>approver_token</code>. Usa el
          link que recibiste por correo.
        </AlertDescription>
      </Alert>
    );
  }

  if (purchase === null) {
    return (
      <OtpGateView approvalToken={approvalToken} onVerified={setPurchase} />
    );
  }

  return (
    <ApprovalDetailView approvalToken={approvalToken} purchase={purchase} />
  );
};
