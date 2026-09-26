'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { formatDate } from '@/lib/format';
import { Icon } from '@/components/icon';
import { displayName, shortAddress, userMetaLine } from '@/lib/format';
import type { UserBrief } from '@/types';

/** 悬停多久之后弹出名片，和推特的手感接近 */
const HOVER_DELAY = 420;

interface UserIdentityProps {
  user: UserBrief;
  size?: number;
  /** 昵称下面那一行是否展示入学年份 / 学院 / 专业 */
  meta?: boolean;
  /** 悬停名片出现的方向 */
  placement?: 'top' | 'bottom';
  /** 名片里额外展示注册时间 */
  joinedAt?: string;
  className?: string;
}

/**
 * 统一的人物展示：头像 + 昵称 + 资料行，鼠标悬停后弹出推特式名片。
 * 论坛、文章、评论、校友墙都用它，保证处处一致。
 */
export function UserIdentity({
  user,
  size = 40,
  meta = true,
  placement = 'top',
  joinedAt,
  className,
}: UserIdentityProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  function cancel() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function schedule() {
    cancel();
    timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY);
  }

  function close() {
    cancel();
    setOpen(false);
  }

  useEffect(() => cancel, []);

  const line = userMetaLine(user);
  const classes = ['user-identity', className].filter(Boolean).join(' ');

  return (
    <span className={classes} onMouseEnter={schedule} onMouseLeave={close}>
      <Link className="user-identity-link" href={`/u/${user.address}`}>
        <Avatar address={user.address} nickname={user.nickname} src={user.avatar_url} size={size} />
        <span className="user-identity-text">
          <strong>{displayName(user)}</strong>
          {meta && line && <span className="user-identity-meta">{line}</span>}
        </span>
      </Link>
      {open && <UserHoverCard user={user} line={line} placement={placement} joinedAt={joinedAt} />}
    </span>
  );
}

function UserHoverCard({
  user,
  line,
  placement,
  joinedAt,
}: {
  user: UserBrief;
  line: string;
  placement: 'top' | 'bottom';
  joinedAt?: string;
}) {
  return (
    <div className={`user-hover-card user-hover-${placement}`} role="tooltip">
      <div
        className="user-hover-banner"
        style={user.banner_url ? { backgroundImage: `url(${user.banner_url})` } : undefined}
      >
        {!user.banner_url && <Icon name="spark" size={22} />}
      </div>
      <div className="user-hover-body">
        <span className="user-hover-avatar">
          <Avatar address={user.address} nickname={user.nickname} src={user.avatar_url} size={62} />
        </span>
        <strong>{displayName(user)}</strong>
        <span className="mono muted">{shortAddress(user.address)}</span>
        {line ? (
          <p className="user-hover-meta">{line}</p>
        ) : (
          <p className="user-hover-meta muted">还没有填写院系信息</p>
        )}
        {user.university && <p className="user-hover-meta">{user.university}</p>}
        {joinedAt && (
          <p className="user-hover-joined">
            <Icon name="clock" size={13} />
            {formatDate(joinedAt)} 加入
          </p>
        )}
        <span className="user-hover-hint">
          查看个人主页 <Icon name="arrow" size={13} />
        </span>
      </div>
    </div>
  );
}
