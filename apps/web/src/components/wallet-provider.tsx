'use client';

import { BrowserProvider, type Eip1193Provider } from 'ethers';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, api, getToken, setToken } from '@/lib/api';
import type { UserPublic } from '@/types';

/** ethers 的 Eip1193Provider 只声明了 request，钱包插件还会提供事件订阅 */
interface InjectedWallet extends Eip1193Provider {
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: InjectedWallet;
  }
}

export type WalletStatus = 'loading' | 'anonymous' | 'connecting' | 'authenticated';

interface WalletContextValue {
  status: WalletStatus;
  address: string | null;
  user: UserPublic | null;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  logout: () => void;
  /** 资料/头像更新后同步最新用户信息 */
  applyUser: (user: UserPublic) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function describeError(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof Error) {
    const code = (cause as { code?: unknown }).code;
    if (code === 'ACTION_REJECTED' || code === 4001) return '你在钱包里取消了签名';
    return cause.message;
  }
  return '连接钱包失败，请重试';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [address, setAddress] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

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

  // 钱包里切换/断开账户后，原来的登录态不再可信
  useEffect(() => {
    const provider = window.ethereum;
    setHasProvider(Boolean(provider));
    if (!provider?.on || !provider.removeListener) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const next = accounts?.[0];
      if (!next || next.toLowerCase() !== address) logout();
    };

    provider.on('accountsChanged', handleAccountsChanged);
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, [address, logout]);

  const connect = useCallback(async () => {
    if (!window.isSecureContext) {
      setError('当前为 HTTP 预览地址。绑定域名并启用 HTTPS 后，才能安全使用钱包登录。');
      return;
    }
    const ethereum = window.ethereum;
    if (!ethereum) {
      setError('没有检测到 MetaMask，请先安装小狐狸钱包插件');
      return;
    }

    setError(null);
    setStatus('connecting');
    try {
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const account = accounts[0];
      if (!account) throw new Error('钱包没有返回任何账户');

      const provider = new BrowserProvider(ethereum);
      const challenge = await api.nonce(account);
      const signer = await provider.getSigner(account);
      const signature = await signer.signMessage(challenge.message);
      const session = await api.verify(challenge.message, signature);

      setToken(session.access_token);
      setUser(session.user);
      setAddress(session.user.address);
      setStatus('authenticated');
    } catch (cause) {
      setToken(null);
      setUser(null);
      setAddress(null);
      setStatus('anonymous');
      setError(describeError(cause));
    }
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ status, address, user, error, hasProvider, connect, logout, applyUser }),
    [status, address, user, error, hasProvider, connect, logout, applyUser],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet 只能在 WalletProvider 内部使用');
  return context;
}
