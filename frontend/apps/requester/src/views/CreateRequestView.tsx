import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Separator,
} from '@amm/ui';
import { createApiClient, type ApproverInput } from '@amm/api';

const emptyApprovers: ApproverInput[] = [
  { role: '', name: '', email: '' },
  { role: '', name: '', email: '' },
  { role: '', name: '', email: '' },
];

export const CreateRequestView = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [approvers, setApprovers] = useState<ApproverInput[]>(emptyApprovers);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateApprover = (
    index: number,
    field: keyof ApproverInput,
    value: string,
  ) => {
    setApprovers((current) =>
      current.map((approver, position) =>
        position === index ? { ...approver, [field]: value } : approver,
      ),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const created = await createApiClient().createRequest({
        title,
        description,
        amount: Number(amount),
        requester: {
          id: 'user-001',
          name: 'Solicitante Demo',
          email: 'requester@example.com',
        },
        approvers,
      });

      navigate(`/requests/${created.requestId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>Nueva solicitud de compra</CardTitle>
          <CardDescription>
            Los tres aprobadores firman en orden. El segundo no puede actuar
            hasta que el primero firme.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error !== null && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo crear la solicitud</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripcion</Label>
            <Input
              id="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
              required
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-sm font-medium">Aprobadores</p>
            {approvers.map((approver, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
              >
                <div className="grid gap-2">
                  <Label htmlFor={`role-${String(index)}`}>
                    Rol {index + 1}
                  </Label>
                  <Input
                    id={`role-${String(index)}`}
                    value={approver.role}
                    onChange={(event) => {
                      updateApprover(index, 'role', event.target.value);
                    }}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`name-${String(index)}`}>Nombre</Label>
                  <Input
                    id={`name-${String(index)}`}
                    value={approver.name}
                    onChange={(event) => {
                      updateApprover(index, 'name', event.target.value);
                    }}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`email-${String(index)}`}>Correo</Label>
                  <Input
                    id={`email-${String(index)}`}
                    type="email"
                    value={approver.email}
                    onChange={(event) => {
                      updateApprover(index, 'email', event.target.value);
                    }}
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear solicitud'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
