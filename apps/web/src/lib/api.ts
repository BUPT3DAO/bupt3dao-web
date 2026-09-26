import type {
  AdminEntry,
  AdminUser,
  Article,
  ArticlePayload,
  ArticleSummary,
  Challenge,
  Comment,
  CommentPage,
  Member,
  MemberDetails,
  MoveDirection,
  NotificationFeed,
  NotificationSummary,
  PageResult,
  Post,
  PostPayload,
  PostSummary,
  ProfilePayload,
  SiteConfig,
  TokenResponse,
  UserProfile,
  UserPublic,
} from '@/types';

export const TOKEN_STORAGE_KEY = 'bupt3dao.token';
let sessionToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    sessionToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return sessionToken;
  } catch {
    // 浏览器禁用站点存储时仍允许当前标签页使用刚刚取得的登录态。
    return sessionToken;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  sessionToken = token;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // 内存态只在当前标签页有效；存储可用时仍按原行为跨刷新保留。
  }
}

/** 消息被读掉之后立刻同步侧边栏角标，不必等下一次路由变化 */
export const UNREAD_EVENT = 'bupt3dao:unread';

export function emitUnread(unread: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<number>(UNREAD_EVENT, { detail: unread }));
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === 'string') return data.detail;
    // 参数校验失败时 detail 是数组，这里不展开，给一句通用提示
    return '请求参数不合法';
  } catch {
    return '请求失败，请稍后重试';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  members: (q = '', offset = 0) =>
    request<PageResult<Member>>(`/members?q=${encodeURIComponent(q)}&offset=${offset}&limit=12`),

  adminUsers: (q = '', offset = 0, featuredOnly = false) =>
    request<PageResult<AdminUser>>(
      `/admin/users?q=${encodeURIComponent(q)}&offset=${offset}&limit=12&featured_only=${featuredOnly}`,
    ),

  adminPosts: (q = '', offset = 0) =>
    request<PageResult<PostSummary>>(
      `/admin/posts?q=${encodeURIComponent(q)}&offset=${offset}&limit=12`,
    ),

  listAdmins: () => request<PageResult<AdminEntry>>('/admin/admins'),

  addAdmin: (address: string) =>
    request<AdminEntry>('/admin/admins', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  removeAdmin: (address: string) =>
    request<void>(`/admin/admins/${address}`, { method: 'DELETE' }),

  banUser: (address: string, isBanned: boolean, reason = '') =>
    request<AdminUser>(`/admin/users/${address}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ is_banned: isBanned, reason }),
    }),

  featureMember: (address: string, details: MemberDetails) =>
    request<Member>(`/admin/members/${address}`, { method: 'PUT', body: JSON.stringify(details) }),

  unfeatureMember: (address: string) =>
    request<void>(`/admin/members/${address}`, { method: 'DELETE' }),

  nonce: (address: string) =>
    request<Challenge>('/auth/nonce', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  verify: (message: string, signature: string) =>
    request<TokenResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    }),

  me: () => request<UserPublic>('/auth/me'),

  listPosts: (options: { q?: string; topic?: string; offset?: number; limit?: number } = {}) => {
    const { q = '', topic = '', offset = 0, limit = 20 } = options;
    const search = new URLSearchParams({
      q,
      topic,
      offset: String(offset),
      limit: String(limit),
    });
    return request<PageResult<PostSummary>>(`/posts?${search.toString()}`);
  },

  getPost: (id: number) => request<Post>(`/posts/${id}`),

  createPost: (payload: PostPayload) =>
    request<Post>('/posts', { method: 'POST', body: JSON.stringify(payload) }),

  deletePost: (id: number) => request<void>(`/posts/${id}`, { method: 'DELETE' }),

  listComments: (postId: number, offset = 0, limit = 20) =>
    request<CommentPage>(`/posts/${postId}/comments?offset=${offset}&limit=${limit}`),

  createComment: (postId: number, content: string, parentId?: number) =>
    request<Comment>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(parentId ? { content, parent_id: parentId } : { content }),
    }),

  deleteComment: (postId: number, commentId: number) =>
    request<void>(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),

  listNotifications: (offset = 0, limit = 20) =>
    request<NotificationFeed>(`/notifications?offset=${offset}&limit=${limit}`),

  notificationSummary: () => request<NotificationSummary>('/notifications/summary'),

  readNotification: (id: number) =>
    request<NotificationSummary>(`/notifications/${id}/read`, { method: 'POST' }),

  getUser: (address: string) => request<UserProfile>(`/users/${address}`),

  listUserPosts: (address: string, offset = 0, limit = 20) =>
    request<PageResult<PostSummary>>(`/users/${address}/posts?offset=${offset}&limit=${limit}`),

  updateProfile: (payload: ProfilePayload) =>
    request<UserPublic>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),

  listArticles: (offset = 0, limit = 20) =>
    request<PageResult<ArticleSummary>>(`/articles?offset=${offset}&limit=${limit}`),

  getArticle: (id: number) => request<Article>(`/articles/${id}`),

  createArticle: (payload: ArticlePayload) =>
    request<Article>('/articles', { method: 'POST', body: JSON.stringify(payload) }),

  updateArticle: (id: number, payload: ArticlePayload) =>
    request<Article>(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteArticle: (id: number) => request<void>(`/articles/${id}`, { method: 'DELETE' }),

  adminArticles: (q = '', offset = 0) =>
    request<PageResult<ArticleSummary>>(
      `/admin/articles?q=${encodeURIComponent(q)}&offset=${offset}&limit=12`,
    ),

  pinArticle: (id: number, isPinned: boolean) =>
    request<ArticleSummary>(`/admin/articles/${id}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ is_pinned: isPinned }),
    }),

  moveArticle: (id: number, direction: MoveDirection) =>
    request<void>(`/admin/articles/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    }),

  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<UserPublic>('/users/me/avatar', { method: 'POST', body });
  },

  uploadBanner: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<UserPublic>('/users/me/banner', { method: 'POST', body });
  },

  /** markdown 正文里插入的图片，返回可写进 ![]() 的地址 */
  uploadImage: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ url: string }>('/users/me/images', { method: 'POST', body });
  },

  siteConfig: () => request<SiteConfig>('/site'),

  uploadGroupQrcode: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<SiteConfig>('/admin/site/qrcode', { method: 'POST', body });
  },

  removeGroupQrcode: () => request<void>('/admin/site/qrcode', { method: 'DELETE' }),

  updateAnnouncement: (content: string) =>
    request<SiteConfig>('/admin/site/announcement', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
};
