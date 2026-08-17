import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@amm/ui';

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class RemoteBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Fallo un micro-frontend', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.message !== null) {
      return (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar esta seccion</AlertTitle>
          <AlertDescription>
            Verifica que los micro-frontends esten levantados. Detalle:{' '}
            {this.state.message}
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
