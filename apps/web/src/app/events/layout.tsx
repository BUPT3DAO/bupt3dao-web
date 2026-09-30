import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '社区活动',
  description: 'BUPT3DAO 社区活动中心。',
  robots: { index: false, follow: false },
  openGraph: { title: '社区活动 · BUPT3DAO', description: 'BUPT3DAO 社区活动中心。' },
};

export default function EventsLayout({ children }: { children: ReactNode }) {
  return children;
}
