'use client';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

import { Web3Providers } from '@/components/web3-providers';
import { ApiError, api, setToken } from '@/lib/api';
import type { UserPublic } from '@/types';

interface WalletRuntimeProps {
  requestId: number;
  onAuthenticated: (token: string, user: UserPublic) => void;
  onAuthenticationError: (message: string) => void;
  onAccountChange: (account: string | null, sessionAddress: string | null) => void;
  sessionAddress: string | null;
  onConnecting: () => void;
}

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

function WalletConnector(props: WalletRuntimeProps) {
  const {
    requestId,
    onAuthenticated,
    onAuthenticationError,
    onAccountChange,
    sessionAddress,
    onConnecting,
  } = props;
  const { openConnectModal } = useConnectModal();
  const { address: account, status: accountStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [awaitingAccount, setAwaitingAccount] = useState(false);
  const handledRequest = useRef(0);
  const authenticating = useRef(false);

  const runSiwe = useCallback(
    async (walletAddress: string) => {
      if (authenticating.current) return;
      authenticating.current = true;
      onConnecting();
      try {
        // 挑战消息仍由后端按 EIP-4361 生成，换钱包不影响登录流程
        const challenge = await api.nonce(walletAddress);
        const signature = await signMessageAsync({ message: challenge.message });
        const session = await api.verify(challenge.message, signature);
        onAuthenticated(session.access_token, session.user);
      } catch (cause) {
        setToken(null);
        onAuthenticationError(describeError(cause));
      } finally {
        authenticating.current = false;
      }
    },
    [onAuthenticated, onAuthenticationError, onConnecting, signMessageAsync],
  );

  // 钱包换账户后使旧登录态失效；仅在用户主动启用钱包运行时后监听。
  useEffect(() => {
    onAccountChange(account ?? null, sessionAddress);
  }, [account, onAccountChange, sessionAddress]);

  // 若先弹出钱包选择器，等账户连接后再签名，避免刷新页面时误触发签名。
  useEffect(() => {
    if (!awaitingAccount || accountStatus !== 'connected' || !account) return;
    setAwaitingAccount(false);
    void runSiwe(account);
  }, [awaitingAccount, accountStatus, account, runSiwe]);

  // 动态组件加载完成后才尝试打开钱包弹窗。没有连接意图时永远不会加载本模块。
  useEffect(() => {
    if (requestId === 0 || requestId <= handledRequest.current || !openConnectModal) return;
    handledRequest.current = requestId;
    if (accountStatus === 'connected' && account) {
      void runSiwe(account);
      return;
    }
    setAwaitingAccount(true);
    openConnectModal();
  }, [requestId, openConnectModal, accountStatus, account, runSiwe]);

  return null;
}

export default function WalletRuntime(props: WalletRuntimeProps) {
  return (
    <Web3Providers>
      <WalletConnector {...props} />
    </Web3Providers>
  );
}
