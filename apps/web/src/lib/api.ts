import type {
  AdminUser,
  Challenge,
  Member,
  MemberDetails,
  PageResult,
  Post,
  PostList,
  TokenResponse,
  UserProfile,
  UserPublic,
} from '@/types';

const TOKEN_KEY = 'bupt3dao.token';

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
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
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
    request<PostList>(`/admin/posts?q=${encodeURIComponent(q)}&offset=${offset}&limit=12`),

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

  listPosts: (offset = 0, limit = 20) =>
    request<PostList>(`/posts?offset=${offset}&limit=${limit}`),

  createPost: (content: string) =>
    request<Post>('/posts', { method: 'POST', body: JSON.stringify({ content }) }),

  deletePost: (id: number) => request<void>(`/posts/${id}`, { method: 'DELETE' }),

  getUser: (address: string) => request<UserProfile>(`/users/${address}`),

  listUserPosts: (address: string, offset = 0, limit = 20) =>
    request<PostList>(`/users/${address}/posts?offset=${offset}&limit=${limit}`),

  updateProfile: (payload: { nickname?: string; bio?: string }) =>
    request<UserPublic>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),

  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<UserPublic>('/users/me/avatar', { method: 'POST', body });
  },
};
