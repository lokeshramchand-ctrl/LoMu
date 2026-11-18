import type { SVGProps } from 'react';

const P: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z M9.5 15.5c1.4 1.2 3.6 1.2 5 0',
  bookmark: 'M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z',
  search: 'M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z M16 16l4.5 4.5',
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z',
  pause: 'M7 5h3.5v14H7z M13.5 5H17v14h-3.5z',
  next: 'M5 6.2v11.6a.8.8 0 0 0 1.2.7l8.6-5.8a.8.8 0 0 0 0-1.4L6.2 5.5a.8.8 0 0 0-1.2.7Z M18 5.5v13',
  prev: 'M19 6.2v11.6a.8.8 0 0 1-1.2.7l-8.6-5.8a.8.8 0 0 1 0-1.4l8.6-5.8a.8.8 0 0 1 1.2.7Z M6 5.5v13',
  shuffle: 'M3.5 7h3.2c1.6 0 3.1.8 4 2.1l3.6 5.8c.9 1.3 2.4 2.1 4 2.1h2.2 M3.5 17h3.2c1.6 0 3.1-.8 4-2.1l.4-.6 M14.3 9.7l.3-.5c.9-1.4 2.4-2.2 4-2.2h1.9 M18 4.5 20.5 7 18 9.5 M18 14.5l2.5 2.5-2.5 2.5',
  repeat: 'M4 11V9a3 3 0 0 1 3-3h12 M16 3l3 3-3 3 M20 13v2a3 3 0 0 1-3 3H5 M8 21l-3-3 3-3',
  repeatOne: 'M4 11V9a3 3 0 0 1 3-3h12 M16 3l3 3-3 3 M20 13v2a3 3 0 0 1-3 3H5 M8 21l-3-3 3-3 M11.5 10.5 13 9.5v5',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  lyrics: 'M4 6h11 M4 10h8 M4 14h6 M15.5 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18 16.5V8l2.5-1',
  queue: 'M4 6h12 M4 11h12 M4 16h7 M15 14.5v5.5l4.5-2.75L15 14.5Z',
  down: 'M6 9l6 6 6-6',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12 M18 6 6 18',
  plus: 'M12 5v14 M5 12h14',
  volume: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z M16 9.5l5 5 M21 9.5l-5 5',
  radio: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M7.8 16.2a6 6 0 0 1 0-8.4 M16.2 7.8a6 6 0 0 1 0 8.4 M5 19a10 10 0 0 1 0-14 M19 5a10 10 0 0 1 0 14',
  download: 'M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14',
  check: 'M5 12.5 10 17l9-10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20a7.5 7.5 0 0 1 15 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4-2-1.5Z',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6 M3.5 4v4h4 M12 8v4l3 2',
  explicit: 'M5 4h14v16H5z M10 8h4 M10 12h3.5 M10 16h4 M10 8v8',
};

export type IconName = keyof typeof P | 'planet' | 'heartFill';

export function Icon({ name, size = 22, weight = 1.8, ...rest }: { name: IconName; size?: number; weight?: number } & Omit<SVGProps<SVGSVGElement>, "stroke">) {
  if (name === 'planet') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
        <circle cx="12" cy="12" r="5.6" fill="currentColor" stroke="none" />
        <path d="M5.3 14.6C2.6 16.8 1.6 18.8 2.4 19.7c1.3 1.5 6.6-.8 11.8-5.1 5.2-4.3 8.4-9 7.1-10.5-.8-.9-3-.4-5.8 1.1" />
      </svg>
    );
  }
  if (name === 'heartFill') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
        <path d={P.heart} fill="currentColor" />
      </svg>
    );
  }
  const filled = name === 'play' || name === 'pause';
  const d = P[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={name === "more" ? 3.2 : weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
