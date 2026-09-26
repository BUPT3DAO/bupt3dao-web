import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Header } from '@/components/header';
import { WalletProvider } from '@/components/wallet-provider';
import { Web3Providers } from '@/components/web3-providers';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';

// Apply the initial palette before paint; only the theme attribute differs at hydration.
const themeScript = `(()=>{let t='system';try{let s=localStorage.getItem('bupt3dao.theme');if(['light','dark','system'].includes(s))t=s}catch{}document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t})()`;

export const metadata: Metadata = {
  metadataBase: new URL('https://bupt3dao.club'),
  title: { default: 'BUPT3DAO · 连接想法，共建未来', template: '%s · BUPT3DAO' },
  description: '北京邮电大学 Web3 社区。分享技术、发现项目、连接同行者，一起共建开放的未来。',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'BUPT3DAO',
    title: 'BUPT3DAO · 连接想法，共建未来',
    description: '北京邮电大学 Web3 社区。分享技术、发现项目、连接同行者，一起共建开放的未来。',
  },
  twitter: {
    card: 'summary',
    site: '@BUPT3DAO',
    creator: '@BUPT3DAO',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <Web3Providers>
            <WalletProvider>
              <Header />
              <main className="main-content" id="main-content">
                {children}
              </main>
            </WalletProvider>
          </Web3Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
