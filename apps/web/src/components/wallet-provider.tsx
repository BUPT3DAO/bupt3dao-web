'use client';

import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api, getToken, setToken } from '@/lib/api';
import type { UserPublic } from '@/types';

const WalletRuntime = dynamic(() => import('@/components/wallet-runtime'), { ssr: false });

export type WalletStatus = 'loading' | 'anonymous' | 'connecting' | 'authenticated';

interface WalletContextValue {
  status: WalletStatus;
  address: string | null;
  user: UserPublic | null;
  error: string | null;
  connect: () => Promise<void>;
  logout: () => void;
  /** 资料/头像更新后同步最新用户信息 */
  applyUser: (user: UserPublic) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [address, setAddress] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 没有明确的连接意图时不挂载 Wagmi / RainbowKit，避免访客下载钱包 SDK。
  const [walletRuntimeEnabled, setWalletRuntimeEnabled] = useState(false);
  const [walletRequest, setWalletRequest] = useState(0);
  const userRef = useRef(user);
  userRef.current = user;

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAddress(null);
    setError(null);
    setStatus('anonymous');
  }, []);

  const applyUser = useCallback((next: UserPublic) => {
    setUser(next);
    setAddress(next.address);
  }, []);

  // 恢复登录态：本地有 token 就换一次用户信息，换不到说明已失效
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getToken()) {
        setStatus('anonymous');
        return;
      }
      try {
        const me = await api.me();
        if (cancelled) return;
        setUser(me);
        setAddress(me.address);
        setStatus('authenticated');
        // 已登录用户仍需监听扩展钱包换号，维持现有的账户一致性保护。
        setWalletRuntimeEnabled(true);
      } catch {
        if (cancelled) return;
        setToken(null);
        setStatus('anonymous');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('当前为 HTTP 预览地址。绑定域名并启用 HTTPS 后，才能安全使用钱包登录。');
      return;
    }
    setError(null);
    setWalletRuntimeEnabled(true);
    setWalletRequest((request) => request + 1);
  }, []);

  const onAuthenticated = useCallback((token: string, nextUser: UserPublic) => {
    setToken(token);
    setUser(nextUser);
    setAddress(nextUser.address);
    setError(null);
    setStatus('authenticated');
  }, []);

  const onAuthenticationError = useCallback((message: string) => {
    setToken(null);
    setUser(null);
    setAddress(null);
    setStatus('anonymous');
    setError(message);
  }, []);

  const onConnecting = useCallback(() => setStatus('connecting'), []);

  const onAccountChange = useCallback(
    (account: string | null) => {
      const currentUser = userRef.current;
      if (currentUser && account && account.toLowerCase() !== currentUser.address) logout();
    },
    [logout],
  );

  const value = useMemo<WalletContextValue>(
    () => ({ status, address, user, error, connect, logout, applyUser }),
    [status, address, user, error, connect, logout, applyUser],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      {walletRuntimeEnabled && (
        <WalletRuntime
          requestId={walletRequest}
          onAuthenticated={onAuthenticated}
          onAuthenticationError={onAuthenticationError}
          onAccountChange={onAccountChange}
          onConnecting={onConnecting}
        />
      )}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet 只能在 WalletProvider 内部使用');
  return context;
}
