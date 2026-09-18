import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Header } from '@/components/header';
import { WalletProvider } from '@/components/wallet-provider';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'BUPT3DAO · 连接想法，共建未来', template: '%s · BUPT3DAO' },
  description: '北京邮电大学 Web3 社区。分享技术、发现项目、连接同行者，一起共建开放的未来。',
  twitter: {
    card: 'summary',
    site: '@BUPT3DAO',
    creator: '@BUPT3DAO',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <WalletProvider>
          <Header />
          <main className="main-content" id="main-content">
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
