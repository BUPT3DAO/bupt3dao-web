'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { ApiError, api, emitUnread } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import type { InboxItem } from '@/types';

type Category = 'all' | 'community' | 'event';
const labels: Record<Category, string> = { all: '全部', community: '社区互动', event: '活动' };

export default function NotificationsPage() {
  const { user, status, connect, logout } = useWallet();
  const address = user?.address ?? null;
  const addressRef = useRef(address);
  addressRef.current = address;
  const [category, setCategory] = useState<Category>('all');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const pagingController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!address) {
      pagingController.current?.abort();
      pagingController.current = null;
      setItems([]);
      setLoadedKey(null);
      setTotal(0);
      setUnread(0);
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    pagingController.current?.abort();
    pagingController.current = null;
    setItems([]);
    setLoadedKey(null);
    setLoading(true);
    setError('');
    api.inbox(category, 0, 20, controller.signal)
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setLoadedKey(`${address}:${category}`);
        setTotal(data.total);
        setUnread(data.unread);
        emitUnread(data.unread);
      })
      .catch((cause) => {
        if (!active || controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) logout();
        setLoadedKey(`${address}:${category}`);
        setError('消息加载失败，请重试。');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      controller.abort();
      pagingController.current?.abort();
      pagingController.current = null;
    };
  }, [address, category, logout]);

  async function loadMore() {
    if (loadingMore) return;
    const controller = new AbortController();
    pagingController.current = controller;
    setLoadingMore(true);
    setError('');
    try {
      const data = await api.inbox(category, items.length, 20, controller.signal);
      if (controller.signal.aborted) return;
      setItems((current) => [...current, ...data.items]);
      setTotal(data.total);
      setUnread(data.unread);
      emitUnread(data.unread);
    } catch {
      if (!controller.signal.aborted) setError('加载更多失败，请重试。');
    } finally {
      if (pagingController.current === controller) {
        pagingController.current = null;
        setLoadingMore(false);
      }
    }
  }

  function markRead(item: InboxItem) {
    if (item.is_read) return;
    setItems((current) => current.map((row) => row.source === item.source && row.id === item.id
      ? { ...row, is_read: true } : row));
    const next = Math.max(0, unread - 1);
    setUnread(next);
    emitUnread(next);
    api.readInboxItem(item).then((data) => {
      if (addressRef.current !== address) return;
      setUnread(data.unread);
      emitUnread(data.unread);
    }).catch(() => {
      if (addressRef.current === address) setError('这条消息没能标记成已读，刷新页面后可以重试。');
    });
  }

  return (
    <div className="notifications-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STAY IN THE LOOP</span>
          <h1>消息提示<span className="heading-dot">.</span></h1>
          <p>社区互动与关注活动的更新都在这里。</p>
        </div>
        {unread > 0 && <span className="notifications-unread"><Icon name="bell" size={14} />{unread} 条未读</span>}
      </div>
      {status === 'loading' ? <div role="status" className="card loading-card"><div className="skeleton" /></div> : !user ? (
        <div className="card empty-state"><div className="empty-art"><Icon name="bell" size={28} /></div><h3>登录后查看消息</h3><p>连接钱包查看社区和活动提醒。</p><button className="btn btn-primary btn-sm" disabled={status === 'connecting'} onClick={() => void connect()}>{status === 'connecting' ? '等待签名…' : '连接钱包'}</button></div>
      ) : <>
        <div className="feed-tabs inbox-tabs" aria-label="消息类型">{(['all', 'community', 'event'] as Category[]).map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{labels[item]}</button>)}</div>
        {error && <div role="alert" className="inline-notice">{error}</div>}
        {loading || loadedKey !== `${address}:${category}` ? <div role="status" className="card loading-card"><div className="skeleton" /><div className="skeleton" /></div> : items.length ? <ul className="notification-list">{items.map((item) => <li key={`${item.source}-${item.id}`}><Link className={`notification-row${item.is_read ? ' is-read' : ''}`} href={item.href} onClick={() => markRead(item)}><span className="notification-icon"><Icon name={item.source === 'event' ? 'calendar' : 'bell'} size={18} /></span><div className="notification-body"><p className="notification-title"><strong>{item.title}</strong></p><p className="notification-excerpt">{item.message}{item.is_stale ? ' · 旧安排' : ''}</p><time className="muted" dateTime={item.created_at}>{relativeTime(item.created_at)}</time></div>{!item.is_read && <><span className="notification-flag" aria-hidden="true" /><span className="visually-hidden">未读</span></>}</Link></li>)}</ul> : <div className="card empty-state"><div className="empty-art"><Icon name="bell" size={28} /></div><h3>这里还没有消息</h3><p>{category === 'community' ? '有人回复你的帖子或评论时，会在这里提醒你。' : category === 'event' ? '关注活动后，活动变更和开场提醒会显示在这里。' : '社区互动和活动更新会显示在这里。'}</p><Link href={category === 'community' ? '/forum' : '/events'} className="text-link">{category === 'community' ? '逛逛社区论坛' : '查看活动中心'} <Icon name="arrow" size={16} /></Link></div>}
        {items.length < total && <button className="btn btn-ghost load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? '加载中…' : '加载更多'}</button>}
      </>}
    </div>
  );
}
