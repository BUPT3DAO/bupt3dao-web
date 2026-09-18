'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArticleEditor } from '@/components/article-editor';
import { Icon } from '@/components/icon';
import { useWallet } from '@/components/wallet-provider';
import { api } from '@/lib/api';

export default function NewArticlePage() {
  const router = useRouter();
  const { user, status, connect } = useWallet();

  return (
    <div className="article-page">
      <Link href="/articles" className="back-link">
        <Icon name="back" size={17} />
        返回文章墙
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WRITE IT DOWN</span>
          <h1>
            写一篇文章<span className="heading-dot">.</span>
          </h1>
          <p>支持 Markdown，发布后所有社区成员都可以阅读。</p>
        </div>
        <Icon name="edit" size={30} />
      </div>

      {status === 'loading' ? (
        <div className="card loading-card" role="status">
          <div className="skeleton" />
          <p className="muted">正在检查登录状态…</p>
        </div>
      ) : !user ? (
        <section className="card empty-state">
          <div className="empty-art">
            <Icon name="wallet" size={28} />
          </div>
          <h3>连接钱包后即可发布文章</h3>
          <p>社区使用钱包签名登录，无需注册账号，也不会发起任何交易。</p>
          <button
            className="btn btn-primary"
            disabled={status === 'connecting'}
            onClick={() => void connect()}
          >
            {status === 'connecting' ? '等待签名确认…' : '连接钱包'}
          </button>
        </section>
      ) : (
        <ArticleEditor
          submitLabel="发布文章"
          onSubmit={async (payload) => {
            const article = await api.createArticle(payload);
            router.push(`/articles/${article.id}`);
          }}
        />
      )}
    </div>
  );
}
