import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '社区论坛',
  description: '参与 BUPT3DAO 社区讨论，交流技术、共建项目、分享校园生活。',
  openGraph: {
    title: '社区论坛 · BUPT3DAO',
    description: '参与 BUPT3DAO 社区讨论，交流技术、共建项目、分享校园生活。',
  },
};

export default function ForumLayout({ children }: { children: ReactNode }) {
  return children;
}
