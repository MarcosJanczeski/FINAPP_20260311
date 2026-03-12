import type { ReactNode } from 'react';

interface RoutePlaceholderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function RoutePlaceholder({ title, description, children }: RoutePlaceholderProps) {
  return (
    <main style={{ padding: '1rem' }}>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </main>
  );
}
