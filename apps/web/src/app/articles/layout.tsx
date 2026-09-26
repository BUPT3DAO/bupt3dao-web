import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '社区文章',
  description: '阅读 BUPT3DAO 成员分享的 Web3 技术文章、学习笔记与项目复盘。',
  openGraph: {
    title: '社区文章 · BUPT3DAO',
    description: '阅读 BUPT3DAO 成员分享的 Web3 技术文章、学习笔记与项目复盘。',
  },
};

export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return children;
}
