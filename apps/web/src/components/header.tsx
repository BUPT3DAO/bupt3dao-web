'use client';

import Link from 'next/link';

import { Avatar } from '@/components/avatar';
import { useWallet } from '@/components/wallet-provider';
import { displayName } from '@/lib/format';

export function Header() {
  const { status, user, hasProvider, error, connect, logout } = useWallet();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/">
          BUPT3DAO
        </Link>

        <nav className="nav">
          <Link href="/">广场</Link>
          {user && <Link href={`/u/${user.address}`}>我的主页</Link>}
          {user && <Link href="/settings">编辑资料</Link>}
        </nav>

        <div className="wallet-area">
          {status === 'loading' && <span className="muted">加载中…</span>}
          {status === 'connecting' && <span className="muted">等待钱包确认…</span>}
          {status === 'anonymous' && (
            <button className="btn btn-primary" onClick={() => void connect()}>
              连接小狐狸钱包
            </button>
          )}
          {status === 'authenticated' && user && (
            <>
              <Link className="wallet-chip" href={`/u/${user.address}`}>
                <Avatar
                  address={user.address}
                  nickname={user.nickname}
                  src={user.avatar_url}
                  size={28}
                />
                <span>{displayName(user)}</span>
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={logout}>
                退出
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'anonymous' && !hasProvider && (
        <div className="container">
          <p className="hint">没有检测到浏览器钱包插件，请先安装 MetaMask。</p>
        </div>
      )}
      {error && (
        <div className="container">
          <p className="error-text">{error}</p>
        </div>
      )}
    </header>
  );
}
