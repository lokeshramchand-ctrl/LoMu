'use client';
import { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { StyleRegistry as Registry, createStyleRegistry } from 'styled-jsx';

export function StyleRegistry({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => createStyleRegistry());
  useServerInsertedHTML(() => {
    const styles = registry.styles();
    registry.flush();
    return <>{styles}</>;
  });
  return <Registry registry={registry}>{children}</Registry>;
}
