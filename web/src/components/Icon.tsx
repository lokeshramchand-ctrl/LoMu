import type { SVGProps } from 'react';
import { ICONS } from './icons';
import { LINEAR } from './linear-icons';

export type IconName = keyof typeof ICONS | keyof typeof LINEAR;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  if (!(name in ICONS) && name in LINEAR) {
    const { s, b } = LINEAR[name as keyof typeof LINEAR];
    return <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} fill="none" aria-hidden focusable="false" dangerouslySetInnerHTML={{ __html: b }} {...rest} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden focusable="false" {...rest}>
      <path d={ICONS[name as keyof typeof ICONS]} />
    </svg>
  );
}
