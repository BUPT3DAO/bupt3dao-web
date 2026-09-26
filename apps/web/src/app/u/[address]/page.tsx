import type { Metadata } from 'next';
import { cache } from 'react';

import { ProfileClient } from './profile-client';

import { getServerApi } from '@/lib/server-api';
import { displayName } from '@/lib/format';
import type { PageResult, PostSummary, UserProfile } from '@/types';

type ProfilePageProps = { params: Promise<{ address: string }> };

const getProfile = cache((address: string) =>
  getServerApi<UserProfile>(`/users/${encodeURIComponent(address)}`),
);
const getProfilePosts = cache((address: string) =>
  getServerApi<PageResult<PostSummary>>(
    `/users/${encodeURIComponent(address)}/posts?offset=0&limit=20`,
  ),
);

export const dynamic = 'force-dynamic';

function profileDescription(bio: string): string {
  return bio
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { address } = await params;
  const profile = await getProfile(address);
  if (!profile) return { title: '社区名片' };

  const title = displayName(profile);
  const description = profileDescription(profile.bio) || `${title} 的 BUPT3DAO 社区主页。`;
  return {
    title,
    description,
    openGraph: { type: 'profile', title, description },
  };
}

export default async function UserProfilePage({ params }: ProfilePageProps) {
  const { address } = await params;
  const [initialProfile, initialPosts] = await Promise.all([
    getProfile(address),
    getProfilePosts(address),
  ]);
  return (
    <ProfileClient address={address} initialProfile={initialProfile} initialPosts={initialPosts} />
  );
}
