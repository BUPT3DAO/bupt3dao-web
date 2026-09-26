import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '成员风采',
  description: '认识 BUPT3DAO 社区成员与共建者，发现同行的伙伴和正在做的项目。',
  openGraph: {
    title: '成员风采 · BUPT3DAO',
    description: '认识 BUPT3DAO 社区成员与共建者，发现同行的伙伴和正在做的项目。',
  },
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return children;
}
