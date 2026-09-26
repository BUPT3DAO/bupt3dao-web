import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '社区指南',
  description: '了解如何加入 BUPT3DAO、连接钱包、参与社区讨论和贡献代码。',
  openGraph: {
    title: '社区指南 · BUPT3DAO',
    description: '了解如何加入 BUPT3DAO、连接钱包、参与社区讨论和贡献代码。',
  },
};

export default function GuideLayout({ children }: { children: ReactNode }) {
  return children;
}
