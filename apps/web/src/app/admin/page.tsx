'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { AdminArticleRow } from '@/components/admin-article-row';
import { AdminUserCard } from '@/components/admin-user-card';
import { Avatar } from '@/components/avatar';
import { Markdown } from '@/components/markdown';
import { PostCard } from '@/components/post-card';
import { useWallet } from '@/components/wallet-provider';
import { api } from '@/lib/api';
import { shortAddress, userMetaLine } from '@/lib/format';
import type { AdminEntry, AdminUser, ArticleSummary, PostSummary } from '@/types';

const tabs = ['用户管理', '帖子管理', '文章管理', '校友墙管理', '站点设置', '管理员'] as const;
type Tab = (typeof tabs)[number];

const tabIcons: Record<Tab, 'user' | 'message' | 'book' | 'spark' | 'image' | 'shield'> = {
  用户管理: 'user',
  帖子管理: 'message',
  文章管理: 'book',
  校友墙管理: 'spark',
  站点设置: 'image',
  管理员: 'shield',
};

/** 与后端 ANNOUNCEMENT_MAX_LENGTH 保持一致 */
const ANNOUNCEMENT_MAX = 5000;

export default function AdminPage() {
  const { user, status, connect } = useWallet();
  const [tab, setTab] = useState<Tab>('用户管理');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [qrcodeUrl, setQrcodeUrl] = useState<string | null>(null);
  const [qrcodeBusy, setQrcodeBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [newAdmin, setNewAdmin] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user?.is_admin) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    async function load() {
      try {
        if (tab === '站点设置') {
          const data = await api.siteConfig();
          if (!cancelled) {
            setQrcodeUrl(data.group_qrcode_url);
            setAnnouncement(data.announcement);
          }
        } else if (tab === '管理员') {
          const data = await api.listAdmins();
          if (!cancelled) setAdmins(data.items);
        } else if (tab === '帖子管理') {
          const data = await api.adminPosts(query, page * 12);
          if (!cancelled) {
            setPosts(data.items);
            setTotal(data.total);
          }
        } else if (tab === '文章管理') {
          const data = await api.adminArticles(query, page * 12);
          if (!cancelled) {
            setArticles(data.items);
            setTotal(data.total);
          }
        } else {
          const data = await api.adminUsers(query, page * 12, tab === '校友墙管理');
          if (!cancelled) {
            setUsers(data.items);
            setTotal(data.total);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.address, user?.is_admin, tab, query, page, version]);

  function changed(message: string) {
    setNotice(message);
    setVersion((n) => n + 1);
  }
  function switchTab(value: Tab) {
    setTab(value);
    setPage(0);
    setSearch('');
    setQuery('');
    setNotice('');
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
    setPage(0);
  }

  async function addAdmin(event: FormEvent) {
    event.preventDefault();
    const address = newAdmin.trim();
    if (!address || adminBusy) return;
    setAdminBusy(true);
    setAdminError('');
    try {
      await api.addAdmin(address);
      setNewAdmin('');
      changed('管理员已添加');
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : '添加失败，请稍后重试');
    } finally {
      setAdminBusy(false);
    }
  }

  async function revokeAdmin(address: string) {
    if (!window.confirm('移除后，该地址将失去后台权限。确定移除？')) return;
    setAdminBusy(true);
    setAdminError('');
    try {
      await api.removeAdmin(address);
      changed('管理员权限已移除');
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : '移除失败，请稍后重试');
    } finally {
      setAdminBusy(false);
    }
  }

  async function uploadQrcode(file: File) {
    setQrcodeBusy(true);
    setAdminError('');
    try {
      const config = await api.uploadGroupQrcode(file);
      setQrcodeUrl(config.group_qrcode_url);
      changed('社区群二维码已更新');
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : '上传失败，请稍后重试');
    } finally {
      setQrcodeBusy(false);
    }
  }

  async function removeQrcode() {
    if (!window.confirm('移除后首页首屏将不再显示二维码卡片。确定移除？')) return;
    setQrcodeBusy(true);
    setAdminError('');
    try {
      await api.removeGroupQrcode();
      setQrcodeUrl(null);
      changed('社区群二维码已移除');
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : '移除失败，请稍后重试');
    } finally {
      setQrcodeBusy(false);
    }
  }

  async function saveAnnouncement() {
    setAnnouncementBusy(true);
    setAdminError('');
    try {
      const config = await api.updateAnnouncement(announcement);
      setAnnouncement(config.announcement);
      changed(config.announcement ? '首页公告已更新' : '首页公告已撤下');
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : '保存失败，请稍后重试');
    } finally {
      setAnnouncementBusy(false);
    }
  }

  if (!user?.is_admin)
    return (
      <div className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">COMMUNITY OPERATIONS</span>
            <h1>
              管理后台<span className="heading-dot">.</span>
            </h1>
          </div>
        </div>
        <section className="card empty-state">
          <div className="empty-art">
            <Icon name="shield" size={32} />
          </div>
          <h2>
            {status === 'loading'
              ? '正在检查登录状态'
              : user
                ? '当前钱包没有管理员权限'
                : '请使用管理员钱包登录'}
          </h2>
          <p>管理员由服务器上的钱包白名单授权。普通用户无法使用后台功能。</p>
          {!user && (
            <button
              className="btn btn-primary"
              disabled={status === 'loading' || status === 'connecting'}
              onClick={() => void connect()}
            >
              {status === 'connecting' ? '等待签名确认…' : '连接管理员钱包'}
            </button>
          )}
          <div className="gate-return">
            <Link href="/" className="text-link">
              返回首页 <Icon name="arrow" size={16} />
            </Link>
          </div>
        </section>
      </div>
    );

  // 列表已按「置顶优先 + 顺序号」返回，这里补上展示用的顺序号与可移动状态
  const pinnedTotal = articles.filter((item) => item.is_pinned).length;
  let pinnedSeen = 0;
  const articleRows = articles.map((article) => {
    const position = article.is_pinned ? (pinnedSeen += 1) : null;
    return {
      article,
      position,
      canMoveUp: position !== null && position > 1,
      canMoveDown: position !== null && position < pinnedTotal,
    };
  });
  const isEmpty =
    tab === '帖子管理'
      ? posts.length === 0
      : tab === '文章管理'
        ? articles.length === 0
        : users.length === 0;

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">COMMUNITY OPERATIONS</span>
          <h1>
            管理后台<span className="heading-dot">.</span>
          </h1>
          <p>维护社区秩序，也让值得被看见的人被看见。</p>
        </div>
        <span className="admin-role">
          <Icon name="shield" size={16} />
          管理员
        </span>
      </div>
      <div className="admin-tabs" aria-label="管理功能">
        {tabs.map((name) => (
          <button
            key={name}
            className={tab === name ? 'active' : ''}
            aria-pressed={tab === name}
            onClick={() => switchTab(name)}
          >
            <Icon name={tabIcons[name]} size={18} />
            {name}
          </button>
        ))}
      </div>
      <div className="admin-context">
        <div>
          <h2>{tab}</h2>
          <p>
            {tab === '管理员'
              ? '管理员可以添加新的管理员，无需审批；对方的权限在其钱包登录后立即生效。服务器环境变量里的管理员不在这里移除。'
              : tab === '站点设置'
                ? '维护首页首屏的公告与社区群二维码。公告显示在最上方、支持 Markdown；二维码卡片在右侧。改动保存后首页立刻生效。'
                : tab === '校友墙管理'
                ? '只列出已上墙成员。在「用户管理」中搜索并添加新校友；被封禁成员不会公开展示。'
                : tab === '帖子管理'
                  ? '查看全部帖子（含被封禁用户的帖子）。删除操作不可撤销。'
                  : tab === '文章管理'
                    ? '可置顶多篇文章并用上移 / 下移调整顺序，置顶文章会排在文章墙最前面。'
                    : '从已注册成员中选择。可按昵称或完整钱包地址查找；管理员账号不可在此封禁。'}
          </p>
        </div>
        {tab === '校友墙管理' && (
          <Link className="btn btn-ghost btn-sm" href="/members">
            查看公开校友墙 <Icon name="upRight" size={14} />
          </Link>
        )}
        {tab === '文章管理' && (
          <Link className="btn btn-ghost btn-sm" href="/articles">
            查看公开文章墙 <Icon name="upRight" size={14} />
          </Link>
        )}
      </div>
      {tab !== '管理员' && tab !== '站点设置' && (
        <form className="admin-search" onSubmit={submitSearch}>
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="搜索管理内容"
              placeholder={
                tab === '帖子管理'
                  ? '搜索标题、正文、昵称或钱包地址'
                  : tab === '文章管理'
                    ? '搜索标题、正文、昵称或钱包地址'
                    : '搜索昵称或钱包地址'
              }
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            搜索
          </button>
          <span className="muted">共 {total} 条</span>
        </form>
      )}
      {notice && (
        <div role="status" className="success-notice">
          <Icon name="check" size={17} />
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="inline-notice">
          {error}
          <button className="text-link" onClick={() => setVersion((n) => n + 1)}>
            重试
          </button>
        </div>
      )}
      {adminError && (
        <div role="alert" className="inline-notice">
          {adminError}
        </div>
      )}
      {loading ? (
        <div role="status" className="card loading-card">
          <div className="skeleton" />
          <div className="skeleton" />
          <span className="visually-hidden">加载管理数据中</span>
        </div>
      ) : (
        !error &&
        (tab === '管理员' ? (
          <div className="admin-list">
            <form className="card admin-inline-form admin-add-form" onSubmit={addAdmin}>
              <h3>添加管理员</h3>
              <p>输入对方的钱包地址即可授权，不需对方确认。对方下次登录后立即拥有后台权限。</p>
              <div className="admin-form-grid">
                <label className="field">
                  钱包地址
                  <input
                    className="input mono"
                    value={newAdmin}
                    maxLength={42}
                    placeholder="0x…"
                    onChange={(e) => setNewAdmin(e.target.value)}
                  />
                </label>
                <button
                  className="btn btn-primary btn-sm"
                  type="submit"
                  disabled={adminBusy || !newAdmin.trim()}
                >
                  <Icon name="plus" size={14} />
                  {adminBusy ? '处理中…' : '添加管理员'}
                </button>
              </div>
            </form>

            {admins.map((entry) => (
              <article className="card admin-user-card" key={entry.address}>
                <div className="admin-user-summary">
                  <Avatar
                    address={entry.address}
                    nickname={entry.nickname}
                    src={entry.avatar_url}
                    size={44}
                  />
                  <div className="admin-user-identity">
                    <Link href={`/u/${entry.address}`}>
                      {entry.nickname.trim() || shortAddress(entry.address)}
                    </Link>
                    {userMetaLine(entry) && (
                      <span className="admin-user-detail">{userMetaLine(entry)}</span>
                    )}
                    <span className="mono">{entry.address}</span>
                  </div>
                  <div className="admin-badges">
                    {user?.address === entry.address && <span>我</span>}
                    {entry.from_config && <span>服务器配置</span>}
                    <span>{entry.registered ? '已注册' : '未注册'}</span>
                  </div>
                </div>
                <div className="admin-user-meta">
                  <span>
                    {entry.added_at
                      ? `${new Date(entry.added_at).toLocaleDateString('zh-CN')} 添加`
                      : '来自服务器环境变量'}
                  </span>
                  {!entry.registered && <span>对方还没有用钱包登录过</span>}
                </div>
                <div className="admin-user-actions">
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={
                      adminBusy || entry.from_config || user?.address === entry.address
                    }
                    onClick={() => void revokeAdmin(entry.address)}
                  >
                    <Icon name="trash" size={14} />
                    移除权限
                  </button>
                  {entry.from_config && (
                    <span className="muted">服务器配置的管理员需要在 .env 里调整</span>
                  )}
                  {!entry.from_config && user?.address === entry.address && (
                    <span className="muted">不能移除自己的管理员权限</span>
                  )}
                </div>
              </article>
            ))}

            {admins.length === 0 && (
              <div className="card empty-state">
                <h3>还没有管理员记录</h3>
                <p>在上面的输入框里填入钱包地址，即可添加新的管理员。</p>
              </div>
            )}
          </div>
        ) : tab === '站点设置' ? (
          <div className="admin-list">
            <section className="card site-announcement-editor">
              <div className="site-announcement-head">
                <div>
                  <h3>首页公告</h3>
                  <p>
                    显示在首页首屏最上方，支持 Markdown：标题、列表、链接、加粗都能渲染。清空内容后保存即撤下公告。
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={announcementBusy}
                  onClick={() => void saveAnnouncement()}
                >
                  <Icon name="check" size={14} />
                  {announcementBusy ? '保存中…' : '保存公告'}
                </button>
              </div>
              <div className="site-announcement-grid">
                <textarea
                  className="textarea"
                  maxLength={ANNOUNCEMENT_MAX}
                  value={announcement}
                  onChange={(event) => setAnnouncement(event.target.value)}
                  aria-label="首页公告，支持 Markdown"
                  placeholder={'例如：\n\n## 新学期招新\n\n- 时间：每周三 19:00\n- 地点：教三 401\n\n报名请联系 [@BUPT3DAO](https://x.com/BUPT3DAO)'}
                />
                <div className="site-announcement-preview">
                  <span className="eyebrow">MARKDOWN PREVIEW</span>
                  {announcement.trim() ? (
                    <Markdown source={announcement} />
                  ) : (
                    <p className="muted">左侧输入内容后，这里实时预览首页的显示效果。</p>
                  )}
                </div>
              </div>
              <p className="hint">
                当前 {announcement.length} / {ANNOUNCEMENT_MAX} 字
              </p>
            </section>

            <section className="card site-qrcode-editor">
              <div className="site-qrcode-text">
                <h3>首页社区群二维码</h3>
                <p>
                  上传后显示在首页首屏右侧的二维码卡片。替换会删除旧图，移除则整块隐藏。
                </p>
                <label className="btn btn-primary btn-sm" htmlFor="group-qrcode-input">
                  <Icon name="image" size={14} />
                  {qrcodeBusy ? '上传中…' : qrcodeUrl ? '更换二维码' : '上传二维码'}
                </label>
                <input
                  id="group-qrcode-input"
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // 清空 value，同一个文件再次选择也能触发上传
                    event.target.value = '';
                    if (file) void uploadQrcode(file);
                  }}
                  disabled={qrcodeBusy}
                />
                <p className="hint">支持 PNG / JPEG / WebP / GIF，不超过 4 MB，建议用正方形图片。</p>
              </div>
              <div className="site-qrcode-preview">
                {qrcodeUrl ? (
                  <>
                    {/* 二维码是上传文件，经同源 /uploads 代理返回，不需要 Next 图片优化 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrcodeUrl} alt="当前社区群二维码" />
                  </>
                ) : (
                  <span className="muted">尚未设置二维码</span>
                )}
              </div>
            </section>

            {qrcodeUrl && (
              <section className="card site-qrcode-editor">
                <div className="site-qrcode-text">
                  <h3>移除二维码</h3>
                  <p>移除后首页首屏不再出现二维码卡片，随时可以重新上传。</p>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={qrcodeBusy}
                  onClick={() => void removeQrcode()}
                >
                  <Icon name="trash" size={14} />
                  移除二维码
                </button>
              </section>
            )}
          </div>
        ) : (
          <div className="admin-list">
            {tab === '帖子管理' &&
              posts.map((post) => (
                <PostCard key={post.id} post={post} onDeleted={() => changed('帖子已删除')} />
              ))}
            {tab === '文章管理' &&
              articleRows.map((row) => (
                <AdminArticleRow
                  key={`${row.article.id}-${version}`}
                  article={row.article}
                  position={row.position}
                  canMoveUp={row.canMoveUp}
                  canMoveDown={row.canMoveDown}
                  onChanged={changed}
                />
              ))}
            {(tab === '用户管理' || tab === '校友墙管理') &&
              users.map((item) => (
                <AdminUserCard key={`${item.address}-${version}`} user={item} onChanged={changed} />
              ))}
            {isEmpty && (
              <div className="card empty-state">
                <h3>这里暂时没有记录</h3>
                <p>
                  {tab === '校友墙管理'
                    ? '前往用户管理，选择已注册校友并添加展示信息。'
                    : tab === '文章管理'
                      ? '社区里还没有文章。成员登录后即可在文章墙发布内容。'
                      : '试试其他搜索条件，或返回上一页。'}
                </p>
                {tab === '校友墙管理' && (
                  <button className="btn btn-primary" onClick={() => switchTab('用户管理')}>
                    从注册用户中添加
                  </button>
                )}
              </div>
            )}
          </div>
        )
      ))}
      {tab !== '站点设置' && (
        <div className="pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((n) => n - 1)}
          >
            上一页
          </button>
          <span>第 {page + 1} 页</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={(page + 1) * 12 >= total || loading}
            onClick={() => setPage((n) => n + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
