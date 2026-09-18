export interface UserBrief {
  address: string;
  nickname: string;
  avatar_url: string | null;
  /** 个人主页顶部的背景图 */
  banner_url: string | null;
  /** 入学年份，4 位，例如 2023 */
  cohort: string;
  /** 学院 */
  school: string;
  /** 专业 */
  major: string;
  /** 学校，非北邮可填 */
  university: string;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface UserPublic extends UserBrief {
  bio: string;
  created_at: string;
  is_admin: boolean;
  links: ProfileLink[];
}

export interface UserProfile extends UserPublic {
  post_count: number;
}

export interface ProfilePayload {
  nickname?: string;
  bio?: string;
  cohort?: string;
  school?: string;
  major?: string;
  university?: string;
  links?: ProfileLink[];
}

export interface ArticleSummary {
  id: number;
  title: string;
  excerpt: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  author: UserBrief;
}

export interface Article {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  author: UserBrief;
}

export interface ArticlePayload {
  title: string;
  content: string;
}

export type MoveDirection = 'up' | 'down';

/** 帖子列表项：不含正文，正文只在详情页取 */
export interface PostSummary {
  id: number;
  title: string;
  topic: string;
  excerpt: string;
  created_at: string;
  comment_count: number;
  author: UserBrief;
}

export interface Post extends PostSummary {
  content: string;
}

export interface PostPayload {
  title: string;
  topic: string;
  content: string;
}

/** 帖子评论，最多三级：一级评论 → 回复 → 回复的回复 */
export interface Comment {
  id: number;
  content: string;
  depth: number;
  created_at: string;
  author: UserBrief;
  replies: Comment[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserPublic;
}

export interface Challenge {
  nonce: string;
  message: string;
}

export interface MemberDetails {
  title: string;
  cohort: string;
  introduction: string;
  sort_order: number;
}

export interface Member extends MemberDetails {
  user: UserPublic;
}

export interface AdminUser extends UserPublic {
  is_banned: boolean;
  ban_reason: string;
  post_count: number;
  featured: Member | null;
}

/** 管理后台里的管理员条目，可能是已注册用户，也可能只是一个地址 */
export interface AdminEntry {
  address: string;
  nickname: string;
  avatar_url: string | null;
  banner_url: string | null;
  cohort: string;
  school: string;
  major: string;
  university: string;
  registered: boolean;
  from_config: boolean;
  added_at: string | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}
