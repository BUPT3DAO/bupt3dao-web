'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ThemeSwitch } from '@/components/theme-provider';
import { useWallet } from '@/components/wallet-provider';
import { displayName } from '@/lib/format';

export function Header() {
  const { status, user, hasProvider, error, connect, logout } = useWallet();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const busy = status === 'loading' || status === 'connecting';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMenuOpen(false);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const background = [
      document.getElementById('main-content'),
      document.querySelector<HTMLElement>('.site-header'),
    ];
    document.body.style.overflow = 'hidden';
    background.forEach((element) => {
      if (element) element.inert = true;
    });
    sidebarRef.current?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
      if (event.key !== 'Tab') return;
      const items = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled)',
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => {
        if (element) element.inert = false;
      });
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [menuOpen]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        跳转到内容
      </a>
      <header className="site-header">
        <div className="header-context">
          <button
            className="icon-btn mobile-toggle"
            aria-label={menuOpen ? '关闭导航' : '打开导航'}
            aria-expanded={menuOpen}
            aria-controls="community-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <Link href="/" className="mobile-brand" aria-label="BUPT3DAO 首页">
            <Image src="/bupt3.svg" alt="BUPT3DAO" width={845} height={215} unoptimized />
          </Link>
          <span className="header-label">COMMUNITY</span>
          <span className="header-divider">/</span>
          <span className="header-page-name">
            {pathname === '/'
              ? '首页'
              : pathname === '/forum'
                ? '社区论坛'
                : pathname === '/members'
                  ? '校友墙'
                  : pathname === '/admin'
                    ? '管理后台'
                    : pathname === '/guide'
                      ? '社区指南'
                      : pathname === '/settings'
                        ? '编辑资料'
                        : '个人主页'}
          </span>
        </div>
        <div className="wallet-area">
          <ThemeSwitch />
          {user ? (
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
              <button className="icon-btn" aria-label="退出登录" onClick={logout}>
                <Icon name="logout" size={18} />
              </button>
            </>
          ) : (
            <button className="btn btn-dark" disabled={busy} onClick={() => void connect()}>
              <Icon name="wallet" size={17} />
              {status === 'connecting'
                ? '等待签名确认'
                : status === 'loading'
                  ? '连接中'
                  : '连接钱包'}
            </button>
          )}
        </div>
      </header>

      {menuOpen && (
        <button className="nav-backdrop" aria-label="关闭导航" onClick={() => setMenuOpen(false)} />
      )}
      <aside
        ref={sidebarRef}
        className={`sidebar ${menuOpen ? 'is-open' : ''}`}
        id="community-navigation"
        inert={isMobile && !menuOpen}
        aria-label="社区导航"
      >
        <button
          className="icon-btn sidebar-close"
          aria-label="关闭导航菜单"
          onClick={() => setMenuOpen(false)}
        >
          <Icon name="close" size={17} />
        </button>
        <Link
          className="brand"
          href="/"
          aria-label="BUPT3DAO 首页"
          onClick={() => setMenuOpen(false)}
        >
          <Image src="/bupt3.svg" alt="BUPT3DAO" width={845} height={215} priority unoptimized />
          <small>BUILD BEYOND BOUNDARIES</small>
        </Link>
        <div className="sidebar-caption">你的 Web3 校园</div>
        <nav className="nav" aria-label="主导航" onClick={() => setMenuOpen(false)}>
          <Link
            className={pathname === '/' ? 'active' : ''}
            href="/"
            aria-current={pathname === '/' ? 'page' : undefined}
          >
            <Icon name="grid" />
            首页
            <span className="nav-dot" />
          </Link>
          <Link
            className={pathname === '/forum' ? 'active' : ''}
            href="/forum"
            aria-current={pathname === '/forum' ? 'page' : undefined}
          >
            <Icon name="message" />
            社区论坛
          </Link>
          <Link
            className={pathname === '/members' ? 'active' : ''}
            href="/members"
            aria-current={pathname === '/members' ? 'page' : undefined}
          >
            <Icon name="spark" />
            校友墙
          </Link>
          {user ? (
            <Link
              className={pathname.startsWith('/u/') ? 'active' : ''}
              href={`/u/${user.address}`}
            >
              <Icon name="user" />
              我的主页
            </Link>
          ) : (
            <button onClick={() => void connect()} disabled={busy}>
              <Icon name="user" />
              我的主页
              <Icon name="wallet" size={14} />
            </button>
          )}
          <Link
            className={pathname === '/settings' ? 'active' : ''}
            href="/settings"
            aria-current={pathname === '/settings' ? 'page' : undefined}
          >
            <Icon name="edit" />
            编辑资料
          </Link>
          {user?.is_admin && (
            <Link
              className={pathname === '/admin' ? 'active' : ''}
              href="/admin"
              aria-current={pathname === '/admin' ? 'page' : undefined}
            >
              <Icon name="shield" />
              管理后台
            </Link>
          )}
        </nav>
        <div className="sidebar-section-title">
          探索与共建 <span>↗</span>
        </div>
        <nav className="nav secondary-nav" aria-label="社区资源">
          <a
            href="https://x.com/BUPT3DAO"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="官方 X（Twitter）：@BUPT3DAO"
          >
            <Icon name="x" />
            官方动态
            <Icon name="upRight" size={14} />
          </a>
          <a href="https://github.com/BUPT3DAO" target="_blank" rel="noreferrer">
            <Icon name="code" />
            开源项目
            <Icon name="upRight" size={14} />
          </a>
          <a href="https://ethereum.org/zh/learn/" target="_blank" rel="noreferrer">
            <Icon name="book" />
            Web3 学习
            <Icon name="upRight" size={14} />
          </a>
          <Link href="/guide" onClick={() => setMenuOpen(false)}>
            <Icon name="globe" />
            社区指南
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="join-card">
            <span className="mini-orbit" aria-hidden="true" />
            <span className="eyebrow">YOUR NEXT CHAPTER</span>
            <h3>从一个想法开始。</h3>
            <p>
              找到同行者，一起把想法
              <br />
              变成下一个可能。
            </p>
            <Link href="/forum#composer" className="text-link" onClick={() => setMenuOpen(false)}>
              加入讨论 <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="sidebar-footer">
            <span className="status-dot" /> Built by BUPT, for everyone.
          </div>
          <span className="copyright">© {new Date().getFullYear()} BUPT3DAO</span>
        </div>
      </aside>
      {error && (
        <div className="wallet-notice" role="alert">
          <Icon name="wallet" />
          <span>{error}</span>
          {!hasProvider && (
            <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
              安装 MetaMask <Icon name="upRight" size={14} />
            </a>
          )}
        </div>
      )}
    </>
  );
}
