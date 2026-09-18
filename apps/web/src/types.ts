export interface UserBrief {
  address: string;
  nickname: string;
  avatar_url: string | null;
}

export interface UserPublic extends UserBrief {
  bio: string;
  created_at: string;
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
