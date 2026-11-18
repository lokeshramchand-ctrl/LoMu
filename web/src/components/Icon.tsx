import type { SVGProps } from 'react';
import { ICONS, type IconName } from './icons';

export type { IconName };

/** One glyph from the Phosphor set (see icons.ts). Always paints with currentColor. */
export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden focusable="false" {...rest}>
      <path d={ICONS[name]} />
    </svg>
  );
}
