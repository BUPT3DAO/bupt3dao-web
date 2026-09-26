'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { api, emitUnread } from '@/lib/api';
import { displayName, relativeTime } from '@/lib/format';
import type { NotificationItem } from '@/types';

const PAGE_SIZE = 20;

/** 消息提示：谁回复了你的帖子或评论。点开即视为已读，并跳到对应的帖子。 */
export default function NotificationsPage() {
  const { user, status, connect } = useWallet();
  const address = user?.address ?? null;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const paging = useRef(false);
  const pagingController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!address) {
      pagingController.current?.abort();
      paging.current = false;
      setLoadingMore(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    pagingController.current?.abort();
    paging.current = false;
    setLoadingMore(false);
    setLoading(true);
    setError('');
    api
      .listNotifications(0, PAGE_SIZE, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setUnread(data.unread);
        emitUnread(data.unread);
      })
      .catch(() => {
        if (!cancelled) setError('消息加载失败，请重试。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
      pagingController.current?.abort();
      pagingController.current = null;
    };
  }, [address]);

  async function loadMore() {
    if (paging.current) return;
    paging.current = true;
    const controller = new AbortController();
    pagingController.current = controller;
    setLoadingMore(true);
    setError('');
    try {
      const data = await api.listNotifications(items.length, PAGE_SIZE, controller.signal);
      setItems((current) => [
        ...current,
        ...data.items.filter((item) => !current.some((row) => row.id === item.id)),
      ]);
      setTotal(data.total);
      setUnread(data.unread);
      emitUnread(data.unread);
    } catch {
      if (!controller.signal.aborted) setError('加载更多失败，请重试。');
    } finally {
      if (pagingController.current === controller) {
        pagingController.current = null;
        paging.current = false;
        if (!controller.signal.aborted) setLoadingMore(false);
      }
    }
  }

  /**
   * 点击就变灰：先本地置为已读再发请求，跳转不必等接口返回。
   * 别人的消息不会出现在这里，失败时只是角标稍后自动纠正。
   */
  function open(item: NotificationItem) {
    if (item.is_read) return;
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)),
    );
    const next = Math.max(0, unread - 1);
    setUnread(next);
    emitUnread(next);
    api
      .readNotification(item.id)
      .then((data) => {
        setUnread(data.unread);
        emitUnread(data.unread);
      })
      .catch(() => setError('这条消息没能标记成已读，刷新页面后可以重试。'));
  }

  return (
    <div className="notifications-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STAY IN THE LOOP</span>
          <h1>
            消息提示<span className="heading-dot">.</span>
          </h1>
          <p>有人回复你的帖子或评论时，会在这里留下一条提醒。</p>
        </div>
        {unread > 0 && (
          <span className="notifications-unread">
            <Icon name="bell" size={14} />
            {unread} 条未读
          </span>
        )}
      </div>

      {status === 'loading' ? (
        <div role="status" className="card loading-card">
          <div className="skeleton" />
          <div className="skeleton" />
          <span className="visually-hidden">加载消息中</span>
        </div>
      ) : !user ? (
        <div className="card empty-state">
          <div className="empty-art">
            <Icon name="bell" size={28} />
          </div>
          <h3>登录后查看消息</h3>
          <p>连接钱包，别人回复你时就能在这里看到。</p>
          <button
            className="btn btn-primary btn-sm"
            disabled={status === 'connecting'}
            onClick={() => void connect()}
          >
            {status === 'connecting' ? '等待签名…' : '连接钱包'}
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="inline-notice">
              {error}
            </div>
          )}
          {loading ? (
            <div role="status" className="card loading-card">
              <div className="skeleton" />
              <div className="skeleton" />
              <span className="visually-hidden">加载消息中</span>
            </div>
          ) : items.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-art">
                <Icon name="bell" size={28} />
              </div>
              <h3>还没有新的提醒</h3>
              <p>去论坛聊聊，别人回复你时就会收到消息。</p>
              <Link href="/forum" className="text-link">
                逛逛社区论坛 <Icon name="arrow" size={16} />
              </Link>
            </div>
          ) : (
            <>
              <ul className="notification-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      className={`notification-row${item.is_read ? ' is-read' : ''}`}
                      href={`/forum/${item.post_id}#comment-${item.comment_id}`}
                      onClick={() => open(item)}
                    >
                      <Avatar
                        address={item.actor.address}
                        nickname={item.actor.nickname}
                        src={item.actor.avatar_url}
                        size={38}
                      />
                      <div className="notification-body">
                        <p className="notification-title">
                          <strong>{displayName(item.actor)}</strong>
                          {item.kind === 'post_comment' ? ' 评论了你的帖子 ' : ' 回复了你的评论 '}
                          <span className="notification-post">{item.post_title}</span>
                        </p>
                        {item.excerpt && (
                          <p className="notification-excerpt">{item.excerpt}</p>
                        )}
                        <time className="muted" dateTime={item.created_at}>
                          {relativeTime(item.created_at)}
                        </time>
                      </div>
                      {!item.is_read && (
                        <>
                          <span className="notification-flag" aria-hidden="true" />
                          <span className="visually-hidden">未读</span>
                        </>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              {items.length < total && (
                <button
                  className="btn btn-ghost load-more"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? '加载中…' : '加载更多消息'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
