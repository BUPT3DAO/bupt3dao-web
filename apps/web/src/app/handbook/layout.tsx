import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Web3 入门手册', template: '%s · Web3 入门手册 · BUPT3DAO' },
  description: '写给零基础的 Web3 入门手册：从钱包、助记词和安全常识，到在测试网完成第一笔交易。',
  openGraph: {
    title: 'Web3 入门手册 · BUPT3DAO',
    description: '写给零基础的 Web3 入门手册：从钱包、助记词和安全常识，到在测试网完成第一笔交易。',
  },
};

export default function HandbookLayout({ children }: { children: ReactNode }) {
  return children;
}
