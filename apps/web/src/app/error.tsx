'use client';

import Link from 'next/link';

import { Icon } from '@/components/icon';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card empty-state" role="alert">
      <div className="empty-art">
        <Icon name="shield" size={28} />
      </div>
      <h1>页面暂时出了点问题</h1>
      <p>内容没有正常载入。可以重试，或者先回到首页继续浏览。</p>
      <div className="composer-actions">
        <button className="btn btn-primary" onClick={reset}>
          重试 <Icon name="arrow" size={16} />
        </button>
        <Link className="btn btn-ghost" href="/">
          返回首页
        </Link>
      </div>
    </div>
  );
}
