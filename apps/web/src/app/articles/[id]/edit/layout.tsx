import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '编辑文章',
  robots: { index: false, follow: false },
};

export default function EditArticleLayout({ children }: { children: ReactNode }) {
  return children;
}
