import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon } from '@/components/icon';

export const metadata: Metadata = {
  title: '页面不存在',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="card empty-state">
      <div className="empty-art">
        <Icon name="search" size={28} />
      </div>
      <h1>没有找到这个页面</h1>
      <p>链接可能已失效，或者内容已经被移除。</p>
      <div className="home-actions">
        <Link className="btn btn-primary" href="/forum">
          去社区论坛 <Icon name="arrow" size={16} />
        </Link>
        <Link className="btn btn-ghost" href="/">
          返回首页
        </Link>
      </div>
    </div>
  );
}
