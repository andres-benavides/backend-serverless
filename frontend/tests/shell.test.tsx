import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemoteBoundary } from '../apps/shell/src/RemoteBoundary';

const Explosive = () => {
  throw new Error('remoteEntry.js no responde');
};

describe('RemoteBoundary', () => {
  it('renders its children when nothing fails', () => {
    render(
      <RemoteBoundary>
        <p>contenido</p>
      </RemoteBoundary>,
    );

    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('catches a remote that fails to load instead of blanking the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <RemoteBoundary>
        <Explosive />
      </RemoteBoundary>,
    );

    expect(
      screen.getByText('No se pudo cargar esta seccion'),
    ).toBeInTheDocument();
    expect(screen.getByText(/remoteEntry.js no responde/)).toBeInTheDocument();
  });
});
