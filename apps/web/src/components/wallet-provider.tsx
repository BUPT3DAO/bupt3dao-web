'use client';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAccount, useSignMessage } from 'wagmi';

import { ApiError, api, getToken, setToken } from '@/lib/api';
import type { UserPublic } from '@/types';

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

function describeError(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof Error) {
    const { code, name } = cause as { code?: unknown; name?: string };
    // viem / wagmi 用 4001 或 UserRejectedRequestError 表示用户拒绝了请求
    if (code === 4001 || name === 'UserRejectedRequestError') return '你在钱包里取消了签名';
    return cause.message;
  }
  return '连接钱包失败，请重试';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [address, setAddress] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 点了「连接钱包」之后等账户真正连上再签名，避免刷新页面就弹签名请求
  const [awaitingAccount, setAwaitingAccount] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address: account, status: accountStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();

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

  // 在钱包里换了账户，原来的登录态不再可信
  useEffect(() => {
    if (!user || !account) return;
    if (account.toLowerCase() !== user.address) logout();
  }, [user, account, logout]);

  const runSiwe = useCallback(
    async (walletAddress: string) => {
      setError(null);
      setStatus('connecting');
      try {
        // 挑战消息仍由后端按 EIP-4361 生成，换钱包不影响登录流程
        const challenge = await api.nonce(walletAddress);
        const signature = await signMessageAsync({ message: challenge.message });
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
    },
    [signMessageAsync],
  );

  // 钱包连上后再签名，这样外部只要调一次 connect()
  useEffect(() => {
    if (!awaitingAccount) return;
    if (accountStatus !== 'connected' || !account) return;
    setAwaitingAccount(false);
    void runSiwe(account);
  }, [awaitingAccount, accountStatus, account, runSiwe]);

  const connect = useCallback(async () => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('当前为 HTTP 预览地址。绑定域名并启用 HTTPS 后，才能安全使用钱包登录。');
      return;
    }
    setError(null);

    // 已经连着钱包就直接签名；否则先弹钱包选择器
    if (accountStatus === 'connected' && account) {
      await runSiwe(account);
      return;
    }
    if (!openConnectModal) {
      setError('钱包选择器还没准备好，请刷新页面后重试');
      return;
    }
    setAwaitingAccount(true);
    openConnectModal();
  }, [accountStatus, account, openConnectModal, runSiwe]);

  const value = useMemo<WalletContextValue>(
    () => ({ status, address, user, error, connect, logout, applyUser }),
    [status, address, user, error, connect, logout, applyUser],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet 只能在 WalletProvider 内部使用');
  return context;
}
