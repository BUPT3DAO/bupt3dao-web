export interface UserBrief {
  address: string;
  nickname: string;
  avatar_url: string | null;
}

export interface UserPublic extends UserBrief {
  bio: string;
  created_at: string;
  is_admin: boolean;
}

export interface UserProfile extends UserPublic {
  post_count: number;
}

export interface Post {
  id: number;
  content: string;
  created_at: string;
  author: UserBrief;
}

export interface PostList {
  items: Post[];
  total: number;
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

export interface PageResult<T> {
  items: T[];
  total: number;
}
