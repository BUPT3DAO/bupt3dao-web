import type { CSSProperties } from 'react';

const paths = {
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
  moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z',
  monitor: 'M3 3h18v13H3z M8 21h8 M12 16v5',
  x: 'M4 3h4l12 18h-4L4 3z M20 3l-7 8 M4 21l7-8',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  upRight: 'M6 18 18 6 M6 6h12v12',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  edit: 'm16 3 5 5-12 12-6 1 1-6L16 3z M13 6l5 5',
  wallet: 'M20 7V4H5a2 2 0 0 0 0 4h16v12H5a2 2 0 0 1-2-2V6 M21 12h-6v4h6',
  code: 'm8 5-7 7 7 7 M16 5l7 7-7 7 M14 3l-4 18',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  book: 'M12 5v16 M3 3l9 2 9-2v16l-9 2-9-2V3z',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z m-4 9 3 3 5-5',
  chevron: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12 M6 18 18 6',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  check: 'm5 12 4 4L19 6',
  link: 'm10 13 4-4 M8 15l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0 M16 9l2-2a3 3 0 0 1 4 4l-5 5a3 3 0 0 1-4 0',
  message: 'M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
  logout: 'M9 3H3v18h6 M9 12h12 M16 7l5 5-5 5',
  hash: 'M5 8h16 M3 16h16 M10 3 6 21 M18 3l-4 18',
  pin: 'M12 17v5 M9 3h6l-1 6 4 4H6l4-4-1-6z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
  plus: 'M12 5v14 M5 12h14',
  up: 'M12 19V5 M6 11l6-6 6 6',
  down: 'M12 5v14 M6 13l6 6 6-6',
  cap: 'm2 9 10-5 10 5-10 5L2 9z M6 11.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5',
  image: 'M3 4h18v16H3z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3 M3 17l5-5 3.5 3.5L15 12l6 6',
  reply: 'M9 15l-4-4 4-4 M5 11h9a5 5 0 0 1 5 5v3',
  send: 'M21 3 10 14 M21 3l-7 18-4-7-7-4 18-7z',
  bell: 'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6 M10.3 20a2 2 0 0 0 3.4 0',
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
