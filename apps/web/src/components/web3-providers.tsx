'use client';

import {
  darkTheme,
  getDefaultConfig,
  lightTheme,
  RainbowKitProvider,
  type Wallet,
} from '@rainbow-me/rainbowkit';
import {
  bitgetWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  tokenPocketWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import '@rainbow-me/rainbowkit/styles.css';

const ACCENT = '#6950b5';

/**
 * 只保留浏览器插件接入：这些钱包没装插件时默认会退回 WalletConnect 扫码，
 * 把 installed 明确标成 false 后，RainbowKit 会改走「去安装」引导，不会发起连接。
 */
function injectedOnly<A extends unknown[]>(create: (...args: A) => Wallet) {
  return (...args: A): Wallet => {
    const wallet = create(...args);
    return { ...wallet, installed: Boolean(wallet.installed) };
  };
}

// 没接 WalletConnect，projectId 只是 getDefaultConfig 的占位参数，不会真正使用。
const config = getDefaultConfig({
  appName: 'BUPT3DAO',
  appDescription: '北京邮电大学 Web3 社区',
  appUrl: 'https://bupt3dao.club',
  projectId: 'bupt3dao-injected-wallets',
  chains: [mainnet],
  ssr: true,
  wallets: [
    {
      groupName: '常用钱包',
      wallets: [
        injectedOnly(metaMaskWallet),
        injectedOnly(okxWallet),
        injectedOnly(bitgetWallet),
        injectedOnly(tokenPocketWallet),
        injectedOnly(rabbyWallet),
      ],
    },
  ],
});

/** 跟随站点亮暗色：ThemeProvider 会把最终结果写到 html[data-theme] */
function useColorMode(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setMode(root.dataset.theme === 'dark' ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

export function Web3Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const mode = useColorMode();

  const theme = useMemo(
    () =>
      (mode === 'dark' ? darkTheme : lightTheme)({
        accentColor: ACCENT,
        accentColorForeground: 'white',
        borderRadius: 'medium',
      }),
    [mode],
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} locale="zh-CN" modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
