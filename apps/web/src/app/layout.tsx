import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Header } from '@/components/header';
import { WalletProvider } from '@/components/wallet-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'BUPT3DAO',
  description: '北京邮电大学区块链协会',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <WalletProvider>
          <Header />
          <main className="container">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
