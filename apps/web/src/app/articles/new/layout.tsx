import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '撰写文章',
  robots: { index: false, follow: false },
};

export default function NewArticleLayout({ children }: { children: ReactNode }) {
  return children;
}
